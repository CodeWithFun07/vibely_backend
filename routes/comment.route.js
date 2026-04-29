import { Router } from "express";
import {
  createComment,
  updateComment,
  deleteComment,
  getComments,
} from "../controllers/comment.controller.js";
import isAuthenticated from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * POST /api/v1/comments/create/:postId
 * Create a comment on a post
 * Body: { content, parentCommentId (optional) }
 */
router.route("/create/:postId").post(createComment);

/**
 * PUT /api/v1/comments/update/:commentId
 * Update a comment
 * Body: { content }
 */
router.route("/update/:commentId").put(updateComment);

/**
 * DELETE /api/v1/comments/delete/:commentId
 * Delete a comment
 */
router.route("/delete/:commentId").delete(deleteComment);

/**
 * GET /api/v1/comments/:postId?page=1&limit=10
 * Get comments on a post
 */
router.route("/:postId").get(getComments);

export default router;
