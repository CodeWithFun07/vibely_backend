import { Router } from "express";
import {
  toggleBlock,
  getBlockedUsers,
  isBlocked,
  isBlockedBy,
} from "../controllers/block.controller.js";
import isAuthenticated from "../middlewares/auth.middleware.js";

const router = Router();

// All routes require authentication
router.use(isAuthenticated);

/**
 * POST /api/v1/blocks/toggle/:blockUserId
 * Toggle block on a user
 */
router.route("/toggle/:blockUserId").post(toggleBlock);

/**
 * GET /api/v1/blocks?page=1&limit=10
 * Get list of blocked users
 */
router.route("/").get(getBlockedUsers);

/**
 * GET /api/v1/blocks/check/:checkUserId
 * Check if user is blocked
 */
router.route("/check/:checkUserId").get(isBlocked);

/**
 * GET /api/v1/blocks/isBlockedBy/:checkUserId
 * Check if user is blocked by someone
 */
router.route("/isBlockedBy/:checkUserId").get(isBlockedBy);

export default router;
