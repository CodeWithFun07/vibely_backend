import Bookmark from "../models/bookmark.model.js";
import Post from "../models/post.model.js";
import Like from "../models/like.model.js";
import ApiError from "../utils/apiError.js";
import { invalidatePostDetailCache } from "../utils/cacheAside.js";

class BookmarkService {
  /**
   * Helper to populate isLiked, isBookmarked, and like details for posts
   */
  async _populatePostStatus(posts, userId) {
    if (!posts || posts.length === 0) return posts;

    // Filter out null posts first
    const validPosts = posts.filter(p => p !== null && p !== undefined);
    if (validPosts.length === 0) return [];

    return await Promise.all(
      validPosts.map(async (post) => {
        if (!post) return null;
        
        const postObj = post.toObject ? post.toObject() : post;
        if (!postObj || !postObj._id) return null;
        
        try {
          // Get all likes for this post with user details
          const likes = await Like.find({ 
            liked: postObj._id, 
            target_type: "Post" 
          }).populate({
            path: "liked_by",
            select: "_id username profile.profile_picture"
          }).lean();

          // Get user's like status if userId provided
          let userLike = null;
          let isLiked = false;
          let reaction_type = null;
          
          if (userId && Array.isArray(likes)) {
            userLike = likes.find(like => like.liked_by && like.liked_by._id.toString() === userId.toString());
            isLiked = !!userLike;
            reaction_type = userLike?.reaction_type || null;
          }

          // Group likes by reaction type for display
          const likesByReaction = {};
          if (Array.isArray(likes)) {
            likes.forEach(like => {
              if (!like.liked_by) return;
              if (!likesByReaction[like.reaction_type]) {
                likesByReaction[like.reaction_type] = [];
              }
              likesByReaction[like.reaction_type].push({
                _id: like.liked_by._id,
                username: like.liked_by.username,
                profile_picture: like.liked_by.profile?.profile_picture,
              });
            });
          }

          return {
            ...postObj,
            isLiked,
            reaction_type,
            isBookmarked: true, // Since we're in bookmarks, always true
            likes: (Array.isArray(likes) ? likes : []).map(like => ({
              _id: like.liked_by._id,
              username: like.liked_by.username,
              profile_picture: like.liked_by.profile?.profile_picture,
              reaction_type: like.reaction_type,
              createdAt: like.createdAt,
            })).filter(l => l._id),
            likesByReaction,
          };
        } catch (error) {
          console.error(`Error processing post ${postObj._id}:`, error.message);
          return null;
        }
      }),
    ).then(results => results.filter(r => r !== null));
  }

  /**
   * Toggle bookmark on a post
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Object} - { isBookmarked, message }
   */
  async toggleBookmark(postId, userId) {
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

      let bookmark = await Bookmark.findOne({
        bookmark_by: userId,
        post_id: postId,
      });

      let isBookmarked = false;

      if (!bookmark) {
        // Create bookmark
        await Bookmark.create({
          bookmark_by: userId,
          post_id: postId,
          isActive: true,
        });
        isBookmarked = true;
      } else if (bookmark.isActive) {
        // Deactivate
        bookmark.isActive = false;
        await bookmark.save();
        isBookmarked = false;
      } else {
        // Reactivate
        bookmark.isActive = true;
        await bookmark.save();
        isBookmarked = true;
      }

      await invalidatePostDetailCache(postId);

      return {
        isBookmarked,
        message: isBookmarked ? "Post bookmarked" : "Post removed from bookmarks",
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to toggle bookmark: ${error.message}`);
    }
  }

  /**
   * Get user's bookmarked posts
   * @param {string} userId - User ID
   * @param {number} page - Page number
   * @param {number} limit - Posts per page
   * @returns {Object} - { bookmarks, pagination }
   */
  async getBookmarks(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const skip = (page - 1) * limit;

      const bookmarks = await Bookmark.find({
        bookmark_by: userId,
        isActive: true,
      })
        .populate({
          path: "post_id",
          match: { isDeleted: false },
          populate: {
            path: "created_by",
            match: {
              is_active: true,
              is_verified: true,
              is_banned: false,
              isDeleted: false,
            },
            select:
              "_id username email profile.full_name profile.profile_picture followers_count following_count",
          },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

        console.log(bookmarks)

      // Filter out null posts
      const validBookmarkPosts = bookmarks
        .filter((b) => b.post_id !== null && b.post_id.created_by !== null)
        .map((b) => b.post_id);

      // Populate likes and other details
      const bookmarksWithStatus = await this._populatePostStatus(validBookmarkPosts, userId);

      const totalBookmarks = await Bookmark.countDocuments({
        bookmark_by: userId,
        isActive: true,
      });

      const totalPages = Math.ceil(totalBookmarks / limit);

      return {
        bookmarks: bookmarksWithStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalBookmarks,
          bookmarksPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch bookmarks: ${error.message}`);
    }
  }

  /**
   * Check if post is bookmarked
   * @param {string} postId - Post ID
   * @param {string} userId - User ID
   * @returns {Object} - { isBookmarked }
   */
  async isBookmarked(postId, userId) {
    if (!postId || !userId) {
      throw new ApiError(400, "Post ID and User ID are required");
    }

    try {
      const bookmark = await Bookmark.findOne({
        bookmark_by: userId,
        post_id: postId,
        isActive: true,
      });

      return { isBookmarked: !!bookmark };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Failed to check bookmark status: ${error.message}`,
      );
    }
  }
}

const bookmarkService = new BookmarkService();
export default bookmarkService;
