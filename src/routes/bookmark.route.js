import { Router } from "express";
import {
  toggleBookmark,
  getBookmarks,
  isBookmarked,
} from "../controllers/bookmark.controller.js";
import isAuthenticated from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * PUT /api/v1/bookmarks/toggle/:postId
 * Toggle bookmark on a post
 */
router.route("/toggle/:postId").put(toggleBookmark);

/**
 * GET /api/v1/bookmarks?page=1&limit=10
 * Get user's bookmarked posts
 */
router.route("/").get(getBookmarks);

/**
 * GET /api/v1/bookmarks/check/:postId
 * Check if post is bookmarked
 */
router.route("/check/:postId").get(isBookmarked);

export default router;
