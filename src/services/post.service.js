import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";
import Block from "../models/block.model.js";
import Follow from "../models/follow.model.js";
import Bookmark from "../models/bookmark.model.js";
import Like from "../models/like.model.js";
import {
  uploadMultipleToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import { extractMentions, getUserIdsFromUsernames } from "../utils/mentionHelper.js";
import notificationService from "./notification.service.js";
import {
  cacheGetJson,
  cacheSetJson,
  postDetailCacheKey,
  invalidatePostDetailCache,
  TTL_POST_DETAIL_SECONDS,
  invalidateUserProfileCaches,
} from "../utils/cacheAside.js";

class PostService {
  /**
   * Helper to populate isLiked, isBookmarked, and like details for posts
   */
  async _populatePostStatus(posts, userId) {
    if (!posts || posts.length === 0) return posts;

    return await Promise.all(
      posts.map(async (post) => {
        if (!post) return null;
        const postObj = post.toObject ? post.toObject() : post;

        // Get all likes for this post with user details
        const likes = await Like.find({
          liked: postObj._id,
          target_type: "Post"
        }).populate({
          path: "liked_by",
          select: "_id username profile.profile_picture profile.full_name"
        });

        // Get user's like status if userId provided
        let userLike = null;
        let isLiked = false;
        let reaction_type = null;

        if (userId) {
          userLike = likes.find(like => like.liked_by && like.liked_by._id.toString() === userId.toString());
          isLiked = !!userLike;
          reaction_type = userLike?.reaction_type || null;
        }

        // Get bookmark status
        const bookmark = userId ? await Bookmark.findOne({
          bookmark_by: userId,
          post_id: postObj._id,
          isActive: true
        }) : null;

        // Group likes by reaction type for display
        const likesByReaction = {};
        const likesArray = likes
          .filter(like => like.liked_by) // Filter out likes from deleted users
          .map(like => {
            const userObj = like.liked_by.toObject ? like.liked_by.toObject() : like.liked_by;
            const likeObj = {
              _id: userObj._id,
              username: userObj.username,
              profile_picture: userObj.profile?.profile_picture || null,
              full_name: userObj.profile?.full_name || null,
              reaction_type: like.reaction_type,
              createdAt: like.createdAt,
            };

            // Add to likesByReaction
            if (!likesByReaction[like.reaction_type]) {
              likesByReaction[like.reaction_type] = [];
            }
            likesByReaction[like.reaction_type].push({
              _id: userObj._id,
              username: userObj.username,
              profile_picture: userObj.profile?.profile_picture || null,
              full_name: userObj.profile?.full_name || null,
            });

            return likeObj;
          });

        return {
          ...postObj,
          isLiked,
          reaction_type,
          isBookmarked: !!bookmark,
          likes: likesArray,
          likesByReaction,
          likes_count: likesArray.length,
        };
      }),
    ).then(results => results.filter(p => p !== null));
  }

  /**
   * Create a new post with optional media uploads
   * @param {Object} params - Post data
   * @param {string} params.caption - Post caption/description
   * @param {string} params.visibility - Post visibility (public, followers, close_friends, private)
   * @param {Object} params.location - Location object with coordinates
   * @param {Array} params.media - Media files from multer (req.files)
   * @param {string} params.userId - User ID creating the post
   * @returns {Object} - Created post object
   */
  async createPost({ caption, visibility, location, media, userId }) {
    // Validate user ID
    if (!userId) {
      throw new ApiError(401, "User ID is required for creating a post");
    }

    // Validate caption or media requirement
    if (!caption && (!media || media.length === 0)) {
      throw new ApiError(400, "Caption or media file is required");
    }

    let uploadedMedia = [];

    try {
      // Upload media files to Cloudinary if present
      if (media && media.length > 0) {
        // Validate media files
        const validMediaTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/avif",
          "video/mp4",
          "video/webm",
        ];

        for (const file of media) {
          if (!validMediaTypes.includes(file.mimetype)) {
            throw new ApiError(
              400,
              `Invalid media type: ${file.mimetype}. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM, AVIF`,
            );
          }

          if (file.size > 5 * 1024 * 1024) {
            throw new ApiError(
              400,
              `File size exceeds limit (5MB): ${file.originalname}`,
            );
          }
        }

        // Upload all media files to Cloudinary
        uploadedMedia = await uploadMultipleToCloudinary(media);

        if (!uploadedMedia || uploadedMedia.length === 0) {
          throw new ApiError(500, "Failed to upload media files");
        }
      }

      // Prepare post data
      const postData = {
        caption: caption?.trim() || null,
        visibility: visibility || "public",
        created_by: userId,
        media: uploadedMedia.map((item) => ({
          url: item.url,
          media_public_id: item.public_id,
          type: item.type,
        })),
      };

      // Add location if provided
      if (location && location.coordinates) {
        postData.location = {
          type: "Point",
          coordinates: location.coordinates,
          name: location.name || null,
          address: location.address || null,
        };
      }

      // Create post in database
      const post = await Post.create(postData);

      // Populate and return the created post
      const populatedPost = await post.populate(
        "created_by",
        "username avatar",
      );

      // Handle mentions
      const mentionedUsernames = extractMentions(caption);
      if (mentionedUsernames.length > 0) {
        const mentionedUserIds = await getUserIdsFromUsernames(mentionedUsernames);
        await notificationService.notifyMentions(mentionedUserIds, userId, {
          post: post._id,
        });
      }

      const creator = await User.findById(userId).select("username").lean();
      await invalidateUserProfileCaches(userId, creator?.username);

      return populatedPost;
    } catch (error) {
      // Clean up uploaded media if post creation fails
      if (uploadedMedia && uploadedMedia.length > 0) {
        for (const media of uploadedMedia) {
          try {
            await deleteFromCloudinary(media.public_id, media.type);
          } catch (deleteError) {
            console.error("Error deleting media during cleanup:", deleteError);
          }
        }
      }

      // Re-throw the error or wrap it
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to create post: ${error.message}`);
    }
  }

  async updatePost({
    postId,
    caption,
    visibility,
    location,
    media,
    userId,
    removeMediaIds = [], // Array of media_public_id to remove
  }) {
    // Validate inputs
    if (!postId) {
      throw new ApiError(400, "Post ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    if (
      !caption &&
      (!media || media.length === 0) &&
      removeMediaIds.length === 0
    ) {
      throw new ApiError(
        400,
        "Provide caption, media, or specify media to remove",
      );
    }

    let uploadedNewMedia = [];
    let deletedOldMedia = [];

    try {
      // Find the post
      const existingPost = await Post.findById(postId);

      if (!existingPost) {
        throw new ApiError(404, "Post not found");
      }

      // Verify user is the post creator
      if (existingPost.created_by.toString() !== userId) {
        throw new ApiError(403, "You are not authorized to update this post");
      }

      // Delete specified media from Cloudinary
      if (removeMediaIds && removeMediaIds.length > 0) {
        for (const publicId of removeMediaIds) {
          try {
            // Find media type from existing post
            const mediaItem = existingPost.media.find(
              (m) => m.media_public_id === publicId,
            );
            const mediaType = mediaItem?.type || "image";

            await deleteFromCloudinary(publicId, mediaType);
            deletedOldMedia.push(publicId);

            // Remove from post media array
            existingPost.media = existingPost.media.filter(
              (m) => m.media_public_id !== publicId,
            );
          } catch (deleteError) {
            console.error(`Error deleting media ${publicId}:`, deleteError);
            throw new ApiError(500, `Failed to delete media: ${publicId}`);
          }
        }
      }

      // Upload new media files if provided
      if (media && media.length > 0) {
        // Validate media files
        const validMediaTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "image/avif",
          "video/mp4",
          "video/webm",
        ];

        for (const file of media) {
          if (!validMediaTypes.includes(file.mimetype)) {
            throw new ApiError(
              400,
              `Invalid media type: ${file.mimetype}. Allowed: JPEG, PNG, GIF, WebP, AVIF, MP4, WebM`,
            );
          }

          if (file.size > 5 * 1024 * 1024) {
            throw new ApiError(
              400,
              `File size exceeds limit (5MB): ${file.originalname}`,
            );
          }
        }

        // Upload all new media files
        uploadedNewMedia = await uploadMultipleToCloudinary(media);

        if (!uploadedNewMedia || uploadedNewMedia.length === 0) {
          throw new ApiError(500, "Failed to upload media files");
        }

        // Add new media to post
        uploadedNewMedia.forEach((item) => {
          existingPost.media.push({
            url: item.url,
            media_public_id: item.public_id,
            type: item.type,
          });
        });
      }

      // Update post fields
      if (caption !== undefined) {
        existingPost.caption = caption?.trim() || existingPost.caption;
      }

      if (visibility !== undefined) {
        existingPost.visibility = visibility || existingPost.visibility;
      }

      if (location && location.coordinates) {
        existingPost.location = {
          type: "Point",
          coordinates: location.coordinates,
          name: location.name || existingPost.location.name,
          address: location.address || existingPost.location.address,
        };
      }

      // Mark as edited
      existingPost.is_edited = true;
      existingPost.last_edited_at = new Date();

      // Save updated post
      const updatedPost = await existingPost.save();

      // Populate and return
      const populatedPost = await updatedPost.populate(
        "created_by",
        "username profile.profile_picture",
      );

      // Handle mentions on update
      const mentionedUsernames = extractMentions(caption);
      if (mentionedUsernames.length > 0) {
        const mentionedUserIds = await getUserIdsFromUsernames(mentionedUsernames);
        await notificationService.notifyMentions(mentionedUserIds, userId, {
          post: populatedPost._id,
        });
      }

      await invalidatePostDetailCache(postId);

      return populatedPost;
    } catch (error) {
      // Clean up newly uploaded media if update fails
      if (uploadedNewMedia && uploadedNewMedia.length > 0) {
        for (const media of uploadedNewMedia) {
          try {
            await deleteFromCloudinary(media.public_id, media.type);
          } catch (deleteError) {
            console.error("Error deleting media during cleanup:", deleteError);
          }
        }
      }

      // Re-throw the error
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to update post: ${error.message}`);
    }
  }

  /**
   *
   * @param postId
   * @param userId
   */

  async deletePost({ postId, userId }) {
    if (!postId) {
      throw new ApiError(401, "post id is required");
    }

    if (!userId) {
      throw new ApiError(401, "user id is required");
    }

    const post = await Post.findById(postId);

    if (!post) {
      throw new ApiError(404, "post not found");
    }

    if (post.created_by.toString() !== userId) {
      throw new ApiError(403, "you are not authorized to delete this post");
    }

    if (post.media && post.media.length > 0) {
      for (const media of post.media) {
        try {
          await deleteFromCloudinary(media.media_public_id, media.type);
        } catch (deleteError) {
          console.error("Error deleting media during cleanup:", deleteError);
        }
      }
    }

    post.isDeleted = true;
    post.deleted_at = new Date();
    await post.save();

    await invalidatePostDetailCache(postId);

    return { message: "post deleted successfully" };
  }

  /**
   * Get all posts for feed
   * Filters: non-deleted, non-draft, from active & verified users
   * Excludes: blocked users, banned users
   * Visibility: respects post visibility settings
   * @param {string} userId - Current user ID
   * @param {number} page - Page number (default: 1)
   * @param {number} limit - Posts per page (default: 10)
   * @param {string} search - Search query (optional)
   * @returns {Object} - { posts, pagination }
   */
  async getAllPost(userId, page = 1, limit = 10, search = "") {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      // Get users blocked by current user
      const blockedUsers = await Block.find({
        blocked_by: userId,
        isActive: true,
      }).select("blocked_user");

      const blockedUserIds = blockedUsers.map((block) =>
        block.blocked_user.toString(),
      );

      // Get users the current user is following (for followers visibility)
      const following = await Follow.find({
        followed_by: userId,
      }).select("following");

      const followingIds = following.map((follow) =>
        follow.following.toString(),
      );

      // Calculate skip for pagination
      const skip = (page - 1) * limit;

      // Build query with filters
      const query = {
        isDeleted: false,
        isDraft: false,
        // Exclude blocked users
        created_by: { $nin: blockedUserIds },
        // Visibility filter: show public posts OR posts created by current user OR posts where visibility allows current user to see
        $or: [
          { visibility: "public" },
          { created_by: userId }, // Show own posts regardless of visibility
          {
            visibility: "followers",
            created_by: { $in: followingIds }, // Show followers posts only if user follows the creator
          },
          // Note: close_friends visibility would need additional logic for close friends relationships
          // For now, treating as followers-only
          {
            visibility: "close_friends",
            created_by: { $in: followingIds },
          },
        ],
      };

      // Add search filter if provided
      if (search && search.trim()) {
        const searchRegex = new RegExp(search.trim(), "i");
        query.$and = query.$and || [];
        query.$and.push({
          $or: [
            { caption: { $regex: searchRegex } },
            { "location.name": { $regex: searchRegex } },
            { "location.address": { $regex: searchRegex } }
          ]
        });
      }

      // Find posts
      const posts = await Post.find(query)
        .populate({
          path: "created_by",
          match: {
            // Only include posts from active, verified users
            is_active: true,
            is_verified: true,
            is_banned: false,
            isDeleted: false,
          },
          select:
            "_id username email profile.full_name profile.profile_picture followers_count following_count posts_count",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Filter out posts where user doesn't match criteria (populate returns null if match fails)
      const validPosts = posts.filter((post) => post.created_by !== null);

      // Get total count for pagination
      const totalPosts = await Post.countDocuments(query);

      // Calculate total pages
      const totalPages = Math.ceil(totalPosts / limit);

      // Populate isLiked and isBookmarked
      const postsWithStatus = await this._populatePostStatus(validPosts, userId);

      return {
        posts: postsWithStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          postsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch posts: ${error.message}`);
    }
  }

  /**
   * Get a single post by ID
   * @param {string} postId - Post ID
   * @param {string} userId - Current user ID
   * @returns {Object} - Post object with user details and bookmark status
   */
  async getPostById(postId, userId) {
    if (!postId) {
      throw new ApiError(400, "Post ID is required");
    }

    try {
      const detailCacheKey = postDetailCacheKey(postId, userId);
      const cachedDetail = await cacheGetJson(detailCacheKey);
      if (cachedDetail) {
        return cachedDetail;
      }

      // First check if post exists and get basic info
      const post = await Post.findById(postId).lean();
      if (!post) {
        throw new ApiError(404, "Post not found");
      }

      // Check visibility permissions
      const isOwnPost = post.created_by.toString() === userId;

      if (!isOwnPost) {
        // If not own post, check visibility permissions
        if (post.visibility === "private") {
          throw new ApiError(403, "You don't have permission to view this post");
        }

        if (post.visibility === "followers" || post.visibility === "close_friends") {
          // Check if current user follows the post creator
          const followRelationship = await Follow.findOne({
            followed_by: userId,
            following: post.created_by,
          });

          if (!followRelationship) {
            throw new ApiError(403, "You don't have permission to view this post");
          }
        }
        // Public posts are accessible to everyone
      }

      // If we reach here, user has permission to view the post
      const fullPost = await Post.findById(postId)
        .populate({
          path: "created_by",
          match: {
            is_active: true,
            is_verified: true,
            is_banned: false,
            isDeleted: false,
          },
          select:
            "_id username email profile.full_name profile.profile_picture followers_count following_count posts_count",
        })
        .lean();

      if (!fullPost) {
        throw new ApiError(404, "Post not found");
      }

      if (!fullPost.created_by) {
        throw new ApiError(404, "Post creator is no longer active");
      }

      // Use _populatePostStatus to get complete post data with likes
      const postsWithStatus = await this._populatePostStatus([fullPost], userId);

      const postDetailPayload = postsWithStatus[0];
      await cacheSetJson(
        detailCacheKey,
        postDetailPayload,
        TTL_POST_DETAIL_SECONDS,
      );

      return postDetailPayload;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch post: ${error.message}`);
    }
  }

  /**
   * Get posts from users who follow the current user
   * @param {string} userId - Current user ID
   * @param {number} page - Page number
   * @param {number} limit - Posts per page
   * @returns {Object} - { posts, pagination }
   */
  async getFollowersPost(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const skip = (page - 1) * limit;

      // Get users who follow the current user
      const followers = await Follow.find({
        following: userId,
      }).select("followed_by");

      const followerIds = followers.map((follow) =>
        follow.followed_by.toString(),
      );

      // Get blocked users
      const blockedUsers = await Block.find({
        blocked_by: userId,
        isActive: true,
      }).select("blocked_user");
      const blockedUserIds = blockedUsers.map((block) =>
        block.blocked_user.toString(),
      );

      // Get users the current user is following (for followers visibility)
      const following = await Follow.find({
        followed_by: userId,
      }).select("following");

      const followingIds = following.map((follow) =>
        follow.following.toString(),
      );

      // Build query with visibility filter
      const query = {
        isDeleted: false,
        isDraft: false,
        created_by: {
          $in: followerIds,
          $nin: blockedUserIds,
        },
        // Visibility filter: show public posts OR posts created by current user OR posts where visibility allows current user to see
        $or: [
          { visibility: "public" },
          { created_by: userId }, // Show own posts regardless of visibility
          {
            visibility: "followers",
            created_by: { $in: followingIds }, // Show followers posts only if user follows the creator
          },
          // Note: close_friends visibility would need additional logic for close friends relationships
          {
            visibility: "close_friends",
            created_by: { $in: followingIds },
          },
        ],
      };

      // Find posts
      const posts = await Post.find(query)
        .populate({
          path: "created_by",
          match: {
            is_active: true,
            is_verified: true,
            is_banned: false,
            isDeleted: false,
          },
          select:
            "_id username email profile.full_name profile.profile_picture followers_count following_count posts_count",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const validPosts = posts.filter((post) => post.created_by !== null);

      const totalPosts = await Post.countDocuments(query);
      const totalPages = Math.ceil(totalPosts / limit);

      // Populate status
      const postsWithStatus = await this._populatePostStatus(validPosts, userId);

      return {
        posts: postsWithStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          postsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch followers posts: ${error.message}`);
    }
  }

  /**
   * Get posts from users the current user is following
   * @param {string} userId - Current user ID
   * @param {number} page - Page number
   * @param {number} limit - Posts per page
   * @returns {Object} - { posts, pagination }
   */
  async getFollowingPosts(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const skip = (page - 1) * limit;

      // Get users the current user is following
      const following = await Follow.find({
        followed_by: userId,
      }).select("following");

      const followingIds = following.map((follow) =>
        follow.following.toString(),
      );

      // Get blocked users
      const blockedUsers = await Block.find({
        blocked_by: userId,
        isActive: true,
      }).select("blocked_user");
      const blockedUserIds = blockedUsers.map((block) =>
        block.blocked_user.toString(),
      );

      // Build query with visibility filter
      const query = {
        isDeleted: false,
        isDraft: false,
        created_by: {
          $in: followingIds,
          $nin: blockedUserIds,
        },
        // Visibility filter: show public posts OR posts created by current user OR posts where visibility allows current user to see
        $or: [
          { visibility: "public" },
          { created_by: userId }, // Show own posts regardless of visibility
          {
            visibility: "followers",
            created_by: { $in: followingIds }, // Show followers posts only if user follows the creator
          },
          // Note: close_friends visibility would need additional logic for close friends relationships
          {
            visibility: "close_friends",
            created_by: { $in: followingIds },
          },
        ],
      };

      // Find posts
      const posts = await Post.find(query)
        .populate({
          path: "created_by",
          match: {
            is_active: true,
            is_verified: true,
            is_banned: false,
            isDeleted: false,
          },
          select:
            "_id username email profile.full_name profile.profile_picture followers_count following_count posts_count",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const validPosts = posts.filter((post) => post.created_by !== null);

      const totalPosts = await Post.countDocuments(query);
      const totalPages = Math.ceil(totalPosts / limit);

      // Populate status
      const postsWithStatus = await this._populatePostStatus(validPosts, userId);

      return {
        posts: postsWithStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          postsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch following posts: ${error.message}`);
    }
  }

  /**
   * Get current user's own posts
   * @param {string} userId - Current user ID
   * @param {number} page - Page number
   * @param {number} limit - Posts per page
   * @returns {Object} - { posts, pagination }
   */
  async getCurrentUserPost(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const skip = (page - 1) * limit;

      // Find user's posts (including drafts)
      const query = {
        created_by: userId,
        isDeleted: false,
      };

      const posts = await Post.find(query)
        .populate(
          "created_by",
          "_id username email profile.full_name profile.profile_picture followers_count following_count posts_count",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalPosts = await Post.countDocuments(query);
      const totalPages = Math.ceil(totalPosts / limit);

      // Populate status
      const postsWithStatus = await this._populatePostStatus(posts, userId);

      return {
        posts: postsWithStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          postsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch user posts: ${error.message}`);
    }
  }

  /**
   * Get posts for a specific user's profile (public view)
   * Used when viewing another user's profile page
   * @param {string} profileOwnerId - The user whose profile is being viewed
   * @param {string} viewerId - The current user viewing the profile (null if not logged in)
   * @param {number} page - Page number
   * @param {number} limit - Posts per page
   * @returns {Object} - { posts, pagination }
   */
  async getUserProfilePosts(profileOwnerId, viewerId, page = 1, limit = 20) {
    if (!profileOwnerId) {
      throw new ApiError(400, "Profile owner ID is required");
    }

    try {
      const skip = (page - 1) * limit;

      // Check if viewing own profile
      const isOwnProfile = viewerId && profileOwnerId === viewerId;

      // Build visibility query based on who is viewing
      let visibilityFilter = {};

      if (isOwnProfile) {
        // Own profile - show all posts (public, followers, close_friends, private)
        visibilityFilter = {};
      } else if (viewerId) {
        // Another user's profile - check if viewer follows the profile owner
        const followRelationship = await Follow.findOne({
          followed_by: viewerId,
          following: profileOwnerId,
        });

        const isFollowing = !!followRelationship;

        if (isFollowing) {
          // Following - show public + followers + close_friends posts
          visibilityFilter = {
            $or: [
              { visibility: "public" },
              { visibility: "followers" },
              { visibility: "close_friends" },
            ],
          };
        } else {
          // Not following - show only public posts
          visibilityFilter = {
            visibility: "public",
          };
        }
      } else {
        // Not logged in - show only public posts
        visibilityFilter = {
          visibility: "public",
        };
      }

      // Build final query
      const query = {
        created_by: profileOwnerId,
        isDeleted: false,
        ...visibilityFilter,
      };

      const posts = await Post.find(query)
        .populate(
          "created_by",
          "_id username email profile.full_name profile.profile_picture followers_count following_count posts_count",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalPosts = await Post.countDocuments(query);
      const totalPages = Math.ceil(totalPosts / limit);

      // Populate status
      const postsWithStatus = viewerId
        ? await this._populatePostStatus(posts, viewerId)
        : posts;

      return {
        posts: postsWithStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          postsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch user profile posts: ${error.message}`);
    }
  }

  /**
   * Toggle bookmark on a post
   * @param {string} postId - Post ID
   * @param {string} userId - Current user ID
   * @returns {Object} - { isBookmarked, message }
   */
  async bookmarkUnBookmarkPost(postId, userId) {
    if (!postId) {
      throw new ApiError(400, "Post ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    try {
      // Verify post exists
      const post = await Post.findById(postId);
      if (!post) {
        throw new ApiError(404, "Post not found");
      }

      // Check if bookmark exists
      let bookmark = await Bookmark.findOne({
        bookmark_by: userId,
        post_id: postId,
      });

      if (!bookmark) {
        // Create new bookmark
        bookmark = await Bookmark.create({
          bookmark_by: userId,
          post_id: postId,
          isActive: true,
        });
        return {
          isBookmarked: true,
          message: "Post bookmarked successfully",
        };
      } else if (bookmark.isActive) {
        // Toggle off
        bookmark.isActive = false;
        await bookmark.save();
        return {
          isBookmarked: false,
          message: "Post unbookmarked successfully",
        };
      } else {
        // Toggle on
        bookmark.isActive = true;
        await bookmark.save();
        return {
          isBookmarked: true,
          message: "Post bookmarked successfully",
        };
      }
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to bookmark post: ${error.message}`);
    }
  }

  /**
   * Share a post (increment shares count)
   * @param {string} postId - Post ID
   * @param {string} userId - Current user ID
   * @returns {Object} - Post with updated shares count
   */
  async sharePost(postId, userId) {
    if (!postId) {
      throw new ApiError(400, "Post ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    try {
      // Find and increment shares count
      const post = await Post.findByIdAndUpdate(
        postId,
        { $inc: { shares_count: 1 } },
        { returnDocument: 'after' },
      ).populate(
        "created_by",
        "_id username email profile.full_name profile.profile_picture followers_count following_count posts_count",
      );

      if (!post) {
        throw new ApiError(404, "Post not found");
      }

      return post;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to share post: ${error.message}`);
    }
  }

  /**
   * Get posts by any user (for profile page)
   * @param {string} targetUserId - The user whose posts to fetch
   * @param {string} userId - Requester user ID (for isLiked/isBookmarked)
   * @param {number} page
   * @param {number} limit
   * @returns {Object} - { posts, pagination }
   */
  async getUserPosts(targetUserId, userId, page = 1, limit = 20) {
    if (!targetUserId) {
      throw new ApiError(400, "Target user ID is required");
    }

    try {
      // Check if viewing own profile or if target account is public
      const isOwnProfile = targetUserId === userId;
      let canViewPosts = isOwnProfile;

      const idBlocked = await Block.findOne({
        $or: [
          { blocked_by: userId, blocked_user: targetUserId },
          { blocked_by: targetUserId, blocked_user: userId },
        ],
        isActive: true,
      });

      if (idBlocked) {
        throw new ApiError(401, "You are blocked from this user");
      }

      if (!canViewPosts) {
        // Check if target user's account is private
        const targetUser = await User.findById(targetUserId).select("is_private");

        if (targetUser?.is_private) {
          // Check if current user is a follower
          const Follow = (await import("../models/follow.model.js")).default;
          const isFollower = await Follow.findOne({
            followed_by: userId,
            following: targetUserId,
          });
          canViewPosts = !!isFollower;
        } else {
          // Account is public, can view
          canViewPosts = true;
        }
      }

      // If user can't view posts, return empty array
      if (!canViewPosts) {
        return {
          posts: [],
          pagination: {
            currentPage: page,
            totalPages: 0,
            totalPosts: 0,
            postsPerPage: limit,
            hasNextPage: false,
            hasPrevPage: false,
          },
        };
      }

      const skip = (page - 1) * limit;

      // Build visibility filter based on who is viewing
      let visibilityFilter = {};

      if (isOwnProfile) {
        // Own profile - show all posts (public, followers, close_friends, private)
        visibilityFilter = {};
      } else {
        // Another user's profile - check if viewer follows the profile owner
        const Follow = (await import("../models/follow.model.js")).default;
        const followRelationship = await Follow.findOne({
          followed_by: userId,
          following: targetUserId,
        });

        const isFollowing = !!followRelationship;

        if (isFollowing) {
          // Following - show public + followers + close_friends posts
          visibilityFilter = {
            $or: [
              { visibility: "public" },
              { visibility: "followers" },
              { visibility: "close_friends" },
            ],
          };
        } else {
          // Not following - show only public posts
          visibilityFilter = {
            visibility: "public",
          };
        }
      }

      const query = {
        created_by: targetUserId,
        isDeleted: false,
        isDraft: false,
        ...visibilityFilter,
      };

      const posts = await Post.find(query)
        .populate(
          "created_by",
          "_id username email profile.full_name profile.profile_picture followers_count following_count posts_count",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const totalPosts = await Post.countDocuments(query);
      const totalPages = Math.ceil(totalPosts / limit);

      // Populate status
      const postsWithStatus = await this._populatePostStatus(posts, userId);

      return {
        posts: postsWithStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalPosts,
          postsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, `Failed to fetch user posts: ${error.message}`);
    }
  }
}

const postService = new PostService();

export default postService;
