import { Router } from "express";
import {
  toggleLike,
  getLikes,
  isLiked,
} from "../controllers/like.controller.js";
import isAuthenticated from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * POST /api/v1/likes/toggle
 * Toggle like on a post or comment
 * Body: { targetId, targetType: "Post" | "Comment", reactionType: "like" | "love" | "haha" | "wow" | "sad" | "angry" }
 */
router.route("/toggle").post(toggleLike);

/**
 * GET /api/v1/likes?targetId=id&targetType=Post&page=1&limit=10
 * Get likes on a post or comment
 */
router.route("/").get(getLikes);

/**
 * GET /api/v1/likes/check?targetId=id&targetType=Post
 * Check if user liked a target
 */
router.route("/check").get(isLiked);

export default router;
