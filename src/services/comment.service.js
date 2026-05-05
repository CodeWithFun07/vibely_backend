import Comment from "../models/comment.model.js";
import Post from "../models/post.model.js";
import User from "../models/user.model.js";
import Like from "../models/like.model.js";
import ApiError from "../utils/apiError.js";
import { extractMentions, getUserIdsFromUsernames } from "../utils/mentionHelper.js";
import notificationService from "./notification.service.js";
import { invalidatePostDetailCache } from "../utils/cacheAside.js";

class CommentService {
  /**
   * Helper to populate isLiked, reaction_type, and likes data for comments
   */
  async _populateCommentStatus(comments, userId) {
    if (!comments || comments.length === 0) return comments;

    return await Promise.all(
      comments.map(async (comment) => {
        const commentObj = comment.toObject ? comment.toObject() : comment;
        
        // Get all likes for this comment with user details
        const likes = await Like.find({ 
          liked: commentObj._id, 
          target_type: "Comment" 
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

        const result = {
          ...commentObj,
          isLiked,
          reaction_type,
          likes: likesArray,
          likesByReaction,
          likes_count: likesArray.length,
        };

        // Handle replies recursively
        if (commentObj.replies && commentObj.replies.length > 0) {
          result.replies = await this._populateCommentStatus(
            commentObj.replies,
            userId,
          );
        }

        return result;
      }),
    );
  }
  /**
   * Create a comment on a post
   * @param {string} postId - Post ID
   * @param {string} content - Comment content
   * @param {string} userId - User ID
   * @param {string} parentCommentId - Parent comment ID (for replies)
   * @returns {Object} - Created comment with user details
   */
  async createComment(postId, content, userId, parentCommentId = null) {
    if (!postId) {
      throw new ApiError(400, "Post ID is required");
    }

    if (!content || content.trim().length === 0) {
      throw new ApiError(400, "Comment content is required");
    }

    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    try {
      // Verify post exists
      const post = await Post.findById(postId);
      if (!post || post.isDeleted) {
        throw new ApiError(404, "Post not found");
      }

      // If replying to comment, verify parent comment exists
      if (parentCommentId) {
        const parentComment = await Comment.findById(parentCommentId);
        if (!parentComment) {
          throw new ApiError(404, "Parent comment not found");
        }
      }

      // Create comment
      const comment = await Comment.create({
        content: content.trim(),
        post_id: postId,
        created_by: userId,
        parent_comment: parentCommentId || null,
      });

      // Update post comment count
      await Post.findByIdAndUpdate(postId, {
        $inc: { comments_count: 1 },
      });

      // If replying, update parent comment replies count
      if (parentCommentId) {
        await Comment.findByIdAndUpdate(parentCommentId, {
          $inc: { replies_count: 1 },
        });
      }

      // Populate user details
      const populatedComment = await comment.populate(
        "created_by",
        "_id username email profile.full_name profile.profile_picture",
      );

      // Handle mentions
      const mentionedUsernames = extractMentions(content);
      if (mentionedUsernames.length > 0) {
        const mentionedUserIds = await getUserIdsFromUsernames(mentionedUsernames);
        await notificationService.notifyMentions(mentionedUserIds, userId, {
          post: postId,
          comment: comment._id,
        });
      }

      await invalidatePostDetailCache(postId);

      return populatedComment;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to create comment: ${error.message}`);
    }
  }

  /**
   * Update a comment
   * @param {string} commentId - Comment ID
   * @param {string} content - New content
   * @param {string} userId - User ID (creator only)
   * @returns {Object} - Updated comment
   */
  async updateComment(commentId, content, userId) {
    if (!commentId) {
      throw new ApiError(400, "Comment ID is required");
    }

    if (!content || content.trim().length === 0) {
      throw new ApiError(400, "Comment content is required");
    }

    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    try {
      const comment = await Comment.findById(commentId);

      if (!comment) {
        throw new ApiError(404, "Comment not found");
      }

      if (comment.created_by.toString() !== userId) {
        throw new ApiError(403, "You can only edit your own comments");
      }

      comment.content = content.trim();
      comment.isEdited = true;
      comment.edited_at = new Date();

      await comment.save();

      const populatedComment = await comment.populate(
        "created_by",
        "_id username email profile.full_name profile.profile_picture",
      );

      return populatedComment;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to update comment: ${error.message}`);
    }
  }

  /**
   * Delete a comment
   * @param {string} commentId - Comment ID
   * @param {string} userId - User ID (creator only)
   * @returns {Object} - { message }
   */
  async deleteComment(commentId, userId) {
    if (!commentId) {
      throw new ApiError(400, "Comment ID is required");
    }

    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    try {
      const comment = await Comment.findById(commentId);

      if (!comment) {
        throw new ApiError(404, "Comment not found");
      }

      if (comment.created_by.toString() !== userId) {
        throw new ApiError(403, "You can only delete your own comments");
      }

      // Decrement post comment count
      await Post.findByIdAndUpdate(comment.post_id, {
        $inc: { comments_count: -1 },
      });

      // If parent comment, decrement parent replies count
      if (comment.parent_comment) {
        await Comment.findByIdAndUpdate(comment.parent_comment, {
          $inc: { replies_count: -1 },
        });
      }

      // Delete all replies if this is a main comment
      await Comment.deleteMany({ parent_comment: commentId });

      await Comment.findByIdAndDelete(commentId);

      await invalidatePostDetailCache(String(comment.post_id));

      return { message: "Comment deleted successfully" };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to delete comment: ${error.message}`);
    }
  }

  /**
   * Get comments on a post
   * @param {string} postId - Post ID
   * @param {number} page - Page number
   * @param {number} limit - Comments per page
   * @param {string} userId - Current user ID
   * @returns {Object} - { comments, pagination }
   */
  async getComments(postId, page = 1, limit = 10, userId = null) {
    if (!postId) {
      throw new ApiError(400, "Post ID is required");
    }

    try {
      const skip = (page - 1) * limit;

      // Get main comments (not replies)
      const comments = await Comment.find({
        post_id: postId,
        parent_comment: null,
      })
        .populate(
          "created_by",
          "_id username email profile.full_name profile.profile_picture",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      // Get replies for each comment
      const commentsWithReplies = await Promise.all(
        comments.map(async (comment) => {
          const replies = await Comment.find({
            parent_comment: comment._id,
          })
            .populate(
              "created_by",
              "_id username email profile.full_name profile.profile_picture",
            )
            .sort({ createdAt: 1 });

          return {
            ...comment.toObject(),
            replies,
          };
        }),
      );

      const totalComments = await Comment.countDocuments({
        post_id: postId,
        parent_comment: null,
      });

      const totalPages = Math.ceil(totalComments / limit);

      // Populate like status
      const commentsWithStatus = await this._populateCommentStatus(
        commentsWithReplies,
        userId,
      );

      return {
        comments: commentsWithStatus,
        pagination: {
          currentPage: page,
          totalPages,
          totalComments,
          commentsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch comments: ${error.message}`);
    }
  }

  /**
   * Get a single comment by ID with status
   * @param {string} commentId - Comment ID
   * @param {string} userId - Current user ID (for isLiked)
   * @returns {Object} - Comment with status
   */
  async getCommentById(commentId, userId) {
    if (!commentId) {
      throw new ApiError(400, "Comment ID is required");
    }

    try {
      const comment = await Comment.findById(commentId).populate(
        "created_by",
        "_id username email profile.full_name profile.profile_picture",
      );

      if (!comment) {
        throw new ApiError(404, "Comment not found");
      }

      const populated = await this._populateCommentStatus([comment], userId);
      return populated[0];
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, `Failed to get comment: ${error.message}`);
    }
  }
}

const commentService = new CommentService();
export default commentService;
