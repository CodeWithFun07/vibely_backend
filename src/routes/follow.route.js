import { Router } from "express";
import {
  followUnfollowUser,
  getFollowers,
  getFollowing,
  isFollowing,
  removeFollower,
} from "../controllers/follow.controller.js";
import isAuthenticated from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * POST /api/v1/follow/toggle/:targetUserId
 * Toggle follow/unfollow a user
 */
router.route("/toggle/:targetUserId").post(followUnfollowUser);

/**
 * GET /api/v1/follow/followers/:userId?page=1&limit=10
 * Get list of followers for a specific user or current user
 */
router.route("/followers").get(getFollowers);
router.route("/followers/:userId").get(getFollowers);

/**
 * GET /api/v1/follow/following/:userId?page=1&limit=10
 * Get list of following for a specific user or current user
 */
router.route("/following").get(getFollowing);
router.route("/following/:userId").get(getFollowing);

/**
 * GET /api/v1/follow/isFollowing/:targetUserId
 * Check if following a user
 */
router.route("/isFollowing/:targetUserId").get(isFollowing);

/**
 * DELETE /api/v1/follow/removeFollower/:followerId
 * Remove a follower
 */
router.route("/removeFollower/:followerId").delete(removeFollower);

export default router;
