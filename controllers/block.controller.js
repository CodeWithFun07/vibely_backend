import asyncHandler from "../utils/asyncHandler.js";
import blockService from "../services/block.service.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

/**
 * Toggle block on a user
 * POST /api/v1/blocks/toggle/:blockUserId
 */
const toggleBlock = asyncHandler(async (req, res) => {
  const { blockUserId } = req.params;
  const userId = req.userId;

  const result = await blockService.toggleBlock(userId, blockUserId);

  return res.status(200).json(
    new ApiResponse(
      true,
      result.message,
      200,
      result,
    ),
  );
});

/**
 * Get list of blocked users
 * GET /api/v1/blocks?page=1&limit=10
 */
const getBlockedUsers = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const result = await blockService.getBlockedUsers(userId, page, limit);

  return res.status(200).json(
    new ApiResponse(true, "Blocked users fetched successfully", 200, {
      blockedUsers: result.blockedUsers,
      pagination: result.pagination,
    }),
  );
});

/**
 * Check if user is blocked
 * GET /api/v1/blocks/isBlocked/:checkUserId
 */
const isBlocked = asyncHandler(async (req, res) => {
  const { checkUserId } = req.params;
  const userId = req.userId;

  const result = await blockService.isBlocked(userId, checkUserId);

  return res.status(200).json(
    new ApiResponse(true, "Block status fetched", 200, result),
  );
});

/**
 * Check if user is blocked by someone (reverse check)
 * GET /api/v1/blocks/isBlockedBy/:checkUserId
 */
const isBlockedBy = asyncHandler(async (req, res) => {
  const { checkUserId } = req.params;
  const userId = req.userId;

  const result = await blockService.isBlockedBy(userId, checkUserId);

  return res.status(200).json(
    new ApiResponse(true, "Block status fetched", 200, result),
  );
});

export { toggleBlock, getBlockedUsers, isBlocked, isBlockedBy };
