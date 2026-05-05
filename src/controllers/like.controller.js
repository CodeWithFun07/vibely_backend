import asyncHandler from "../utils/asyncHandler.js";
import likeService from "../services/like.service.js";
import postService from "../services/post.service.js";
import notificationService from "../services/notification.service.js";
import { emitNotification } from "../socket/socketEmitter.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

/**
 * Toggle like on a post or comment
 * POST /api/v1/likes/toggle
 * Body: { targetId, targetType: "Post" | "Comment", reactionType: "like" | "love" | "haha" | "wow" | "sad" | "angry" }
 */
const toggleLike = asyncHandler(async (req, res) => {
  const { targetId, targetType, reactionType } = req.body;
  const userId = req.userId;

  // DEBUG: log incoming toggle like payload
  console.debug('[like.controller] toggleLike payload:', { targetId, targetType, reactionType, userId });

  const result = await likeService.toggleLike(
    targetId,
    targetType,
    userId,
    reactionType || "like",
  );

  // Create notification if liked (not unliked)
  if (result.isLiked && targetType === "Post") {
    try {
      // Fetch post directly from DB to get owner
      const Post = (await import("../models/post.model.js")).default;
      const post = await Post.findById(targetId).select("created_by").lean();
      
      if (!post) {
        console.warn('⚠️ Post not found for notification');
        return res.status(200).json(new ApiResponse(true, result.message, 200, responseData));
      }
      
      const postOwnerId = post?.created_by;
      
      // Only notify if the liker is not the post owner
      if (postOwnerId && postOwnerId.toString() !== userId) {
        const notification = await notificationService.createNotification(
          postOwnerId.toString(),
          userId,
          "like",
          { post: targetId }
        );
        // Emit real-time notification
        if (notification) {
          console.log('🔔 Emitting like notification to user:', postOwnerId.toString());
          emitNotification(postOwnerId.toString(), notification);
        } else {
          console.warn('⚠️ Notification not created - user might have disabled notifications');
        }
      }
    } catch (error) {
      console.error("Notification error (non-critical):", error.message);
    }
  } else if (result.isLiked && targetType === "Comment") {
    try {
      const Comment = (await import("../models/comment.model.js")).default;
      const comment = await Comment.findById(targetId).select("created_by").lean();
      
      if (!comment) {
        console.warn('⚠️ Comment not found for notification');
        return res.status(200).json(new ApiResponse(true, result.message, 200, responseData));
      }
      
      const commentOwnerId = comment?.created_by;
      
      // Only notify if the liker is not the comment owner
      if (commentOwnerId && commentOwnerId.toString() !== userId) {
        const notification = await notificationService.createNotification(
          commentOwnerId.toString(),
          userId,
          "like",
          { comment: targetId }
        );
        // Emit real-time notification
        if (notification) {
          console.log('🔔 Emitting like notification to comment owner:', commentOwnerId.toString());
          emitNotification(commentOwnerId.toString(), notification);
        }
      }
    } catch (error) {
      console.error("Notification error (non-critical):", error.message);
    }
  }

  let responseData = result;

  // If it's a post like/unlike, fetch the updated post with all details
  if (targetType === "Post") {
    try {
      const updatedPost = await postService.getPostById(targetId, userId);
      responseData = {
        ...result,
        post: updatedPost,
      };
    } catch (error) {
      console.error("Error fetching updated post:", error);
      // If there's an error fetching updated post, just return the like toggle result
    }
  } else if (targetType === "Comment") {
    try {
      const commentService = (await import("../services/comment.service.js")).default;
      const updatedComment = await commentService.getCommentById(targetId, userId);
      responseData = {
        ...result,
        comment: updatedComment,
      };
    } catch (error) {
      console.error("Error fetching updated comment:", error);
    }
  }

  return res.status(200).json(
    new ApiResponse(
      true,
      result.message,
      200,
      responseData,
    ),
  );
});

/**
 * Get likes on a post or comment
 * GET /api/v1/likes?targetId=id&targetType=Post&page=1&limit=10
 */
const getLikes = asyncHandler(async (req, res) => {
  const { targetId, targetType } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (!targetId) {
    throw new ApiError(400, "Target ID is required");
  }
  if (!targetType) {
    throw new ApiError(400, "Target type is required");
  }
  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const result = await likeService.getLikes(targetId, targetType, page, limit);

  return res.status(200).json(
    new ApiResponse(true, "Likes fetched successfully", 200, {
      users: result.users,
      reactions: result.reactions,
      pagination: result.pagination,
    }),
  );
});

/**
 * Check if user liked a target
 * GET /api/v1/likes/isLiked?targetId=id&targetType=Post
 */
const isLiked = asyncHandler(async (req, res) => {
  const { targetId, targetType } = req.query;
  const userId = req.userId;

  if (!targetId) {
    throw new ApiError(400, "Target ID is required");
  }
  if (!targetType) {
    throw new ApiError(400, "Target type is required");
  }

  const result = await likeService.isLiked(targetId, targetType, userId);

  return res.status(200).json(
    new ApiResponse(true, "Like status fetched", 200, result),
  );
});

export { toggleLike, getLikes, isLiked };
