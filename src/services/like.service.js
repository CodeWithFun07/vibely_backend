import Like from "../models/like.model.js";
import Post from "../models/post.model.js";
import Comment from "../models/comment.model.js";
import ApiError from "../utils/apiError.js";
import { invalidatePostDetailCache } from "../utils/cacheAside.js";

class LikeService {
  /**
   * Toggle like/unlike on a post or comment
   * @param {string} targetId - Post or Comment ID
   * @param {string} targetType - "Post" or "Comment"
   * @param {string} userId - User ID
   * @param {string} reactionType - like, love, haha, wow, sad, angry
   * @returns {Object} - { isLiked, message }
   */
  async toggleLike(targetId, targetType, userId, reactionType = "like") {
    if (!targetId) {
      throw new ApiError(400, "Target ID is required");
    }

    if (!["Post", "Comment"].includes(targetType)) {
      throw new ApiError(400, "Target type must be 'Post' or 'Comment'");
    }

    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    if (
      ![
        "like",
        "love",
        "haha",
        "wow",
        "sad",
        "angry",
      ].includes(reactionType)
    ) {
      throw new ApiError(400, "Invalid reaction type");
    }

    try {
      // DEBUG: log received reactionType at service layer
      console.debug('[like.service] toggleLike called', { targetId, targetType, userId, reactionType });
      // Verify target exists
      const TargetModel = targetType === "Post" ? Post : Comment;
      const target = await TargetModel.findById(targetId);
      if (!target) {
        throw new ApiError(404, `${targetType} not found`);
      }

      let like = await Like.findOne({
        liked_by: userId,
        liked: targetId,
        target_type: targetType,
      });

      let isLiked = false;

      if (!like) {
        // Create like
        await Like.create({
          liked_by: userId,
          liked: targetId,
          target_type: targetType,
          reaction_type: reactionType,
        });

        // Increment likes count
        await TargetModel.findByIdAndUpdate(targetId, {
          $inc: { likes_count: 1 },
        });

        isLiked = true;
      } else {
        // If same reaction, unlike; if different, update reaction
        if (like.reaction_type === reactionType) {
          // Unlike
          await Like.findByIdAndDelete(like._id);

          // Decrement likes count
          await TargetModel.updateOne(
            { _id: targetId, likes_count: { $gt: 0 } },
            { $inc: { likes_count: -1 } }
          );

          isLiked = false;
        } else {
          // Update reaction
          like.reaction_type = reactionType;
          await like.save();
          isLiked = true;
        }
      }

      if (targetType === "Post") {
        await invalidatePostDetailCache(targetId);
      }

      return {
        isLiked,
        reactionType: isLiked ? reactionType : null,
        message: isLiked ? `${targetType} liked` : `${targetType} unliked`,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to toggle like: ${error.message}`);
    }
  }

  /**
   * Get likes on a post or comment
   * @param {string} targetId - Post or Comment ID
   * @param {string} targetType - "Post" or "Comment"
   * @param {number} page - Page number
   * @param {number} limit - Likes per page
   * @returns {Object} - { likes, pagination }
   */
  async getLikes(targetId, targetType, page = 1, limit = 10) {
    if (!targetId) {
      throw new ApiError(400, "Target ID is required");
    }

    if (!["Post", "Comment"].includes(targetType)) {
      throw new ApiError(400, "Target type must be 'Post' or 'Comment'");
    }

    try {
      const skip = (page - 1) * limit;

      const likes = await Like.find({
        liked: targetId,
        target_type: targetType,
      })
        .populate(
          "liked_by",
          "_id username email profile.full_name profile.profile_picture followers_count",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const users = likes.map((like) => ({
        ...like.liked_by.toObject(),
        reaction_type: like.reaction_type,
      }));

      const totalLikes = await Like.countDocuments({
        liked: targetId,
        target_type: targetType,
      });

      const totalPages = Math.ceil(totalLikes / limit);

      // Count by reaction type
      const reactionCounts = await Like.aggregate([
        { $match: { liked: targetId, target_type: targetType } },
        { $group: { _id: "$reaction_type", count: { $sum: 1 } } },
      ]);

      const reactions = {};
      reactionCounts.forEach((rc) => {
        reactions[rc._id] = rc.count;
      });

      return {
        users,
        reactions,
        pagination: {
          currentPage: page,
          totalPages,
          totalLikes,
          likesPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch likes: ${error.message}`);
    }
  }

  /**
   * Check if user liked a target
   * @param {string} targetId - Post or Comment ID
   * @param {string} targetType - "Post" or "Comment"
   * @param {string} userId - User ID
   * @returns {Object} - { isLiked, reactionType }
   */
  async isLiked(targetId, targetType, userId) {
    if (!targetId || !userId) {
      throw new ApiError(400, "Target ID and User ID are required");
    }

    try {
      const like = await Like.findOne({
        liked_by: userId,
        liked: targetId,
        target_type: targetType,
      });

      return {
        isLiked: !!like,
        reactionType: like?.reaction_type || null,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to check like status: ${error.message}`);
    }
  }
}

const likeService = new LikeService();
export default likeService;
