import asyncHandler from "../utils/asyncHandler.js";
import commentService from "../services/comment.service.js";
import notificationService from "../services/notification.service.js";
import { emitNotification } from "../socket/socketEmitter.js";
import Post from "../models/post.model.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

/**
 * Create a comment on a post
 * POST /api/v1/comments/create/:postId
 * Body: { content, parentCommentId (optional) }
 */
const createComment = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { content, parentCommentId } = req.body;
  const userId = req.userId;

  const result = await commentService.createComment(
    postId,
    content,
    userId,
    parentCommentId,
  );

  // Create notification
  try {
    if (parentCommentId) {
      // Reply notification - notify the comment owner
      const Comment = (await import("../models/comment.model.js")).default;
      const parentComment = await Comment.findById(parentCommentId).populate("created_by");
      const commentOwnerId = parentComment?.created_by?._id;
      if (commentOwnerId && commentOwnerId.toString() !== userId) {
        const notification = await notificationService.createNotification(
          commentOwnerId,
          userId,
          "reply",
          { post: postId, comment: parentCommentId }
        );
        // Emit real-time notification
        if (notification) {
          emitNotification(commentOwnerId.toString(), notification);
        }
      }
    } else {
      // Regular comment notification - notify post owner
      const post = await Post.findById(postId).populate("created_by");
      const postOwnerId = post?.created_by?._id;
      if (postOwnerId && postOwnerId.toString() !== userId) {
        const notification = await notificationService.createNotification(
          postOwnerId,
          userId,
          "comment",
          { post: postId, comment: result._id }
        );
        // Emit real-time notification
        if (notification) {
          emitNotification(postOwnerId.toString(), notification);
        }
      }
    }
  } catch (error) {
    console.log("Notification error (non-critical):", error.message);
  }

  return res.status(201).json(
    new ApiResponse(true, "Comment created successfully", 201, result),
  );
});

/**
 * Update a comment
 * PUT /api/v1/comments/update/:commentId
 * Body: { content }
 */
const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;
  const userId = req.userId;

  const result = await commentService.updateComment(commentId, content, userId);

  return res.status(200).json(
    new ApiResponse(true, "Comment updated successfully", 200, result),
  );
});

/**
 * Delete a comment
 * DELETE /api/v1/comments/delete/:commentId
 */
const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const userId = req.userId;

  const result = await commentService.deleteComment(commentId, userId);

  return res.status(200).json(
    new ApiResponse(true, result.message, 200, result),
  );
});

/**
 * Get comments on a post
 * GET /api/v1/comments/:postId?page=1&limit=10
 */
const getComments = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const userId = req.userId;
  const result = await commentService.getComments(postId, page, limit, userId);

  return res.status(200).json(
    new ApiResponse(true, "Comments fetched successfully", 200, {
      comments: result.comments,
      pagination: result.pagination,
    }),
  );
});

export { createComment, updateComment, deleteComment, getComments };
