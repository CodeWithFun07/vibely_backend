import asyncHandler from "../utils/asyncHandler.js";
import followService from "../services/follow.service.js";
import notificationService from "../services/notification.service.js";
import { emitNotification } from "../socket/socketEmitter.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

/**
 * Toggle follow/unfollow a user
 * POST /api/v1/follow/toggle/:targetUserId
 */
const followUnfollowUser = asyncHandler(async (req, res) => {
  const { targetUserId } = req.params;
  const userId = req.userId;

  const result = await followService.followUnfollowUser(userId, targetUserId);

  // Create notification if following
  if (result.isFollowing) {
    try {
      const notification = await notificationService.createNotification(
        targetUserId,
        userId,
        "follow",
      );
      // Emit real-time notification
      if (notification) {
        emitNotification(targetUserId, notification);
      }
    } catch (error) {
      console.log("Notification error (non-critical):", error.message);
    }
  }

  return res
    .status(200)
    .json(
      new ApiResponse(
        true,
        result.isFollowing
          ? "User followed successfully"
          : "User unfollowed successfully",
        200,
        result,
      ),
    );
});

const getFollowers = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) throw new ApiError(400, "Page must be greater than 0");
  if (limit < 1 || limit > 50)
    throw new ApiError(400, "Limit must be between 1 and 50");

  const result = await followService.getFollowers(userId, page, limit);

  return res.status(200).json(
    new ApiResponse(true, "Followers fetched successfully", 200, {
      followers: result.followers,
      pagination: result.pagination,
    }),
  );
});

const getFollowing = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) throw new ApiError(400, "Page must be greater than 0");
  if (limit < 1 || limit > 50)
    throw new ApiError(400, "Limit must be between 1 and 50");

  const result = await followService.getFollowing(userId, page, limit);

  return res.status(200).json(
    new ApiResponse(true, "Following list fetched successfully", 200, {
      following: result.following,
      pagination: result.pagination,
    }),
  );
});

const isFollowing = asyncHandler(async (req, res) => {
  const { targetUserId } = req.params;
  const userId = req.userId;

  const result = await followService.isFollowing(userId, targetUserId);

  return res
    .status(200)
    .json(new ApiResponse(true, "Following status fetched", 200, result));
});

const removeFollower = asyncHandler(async (req, res) => {
  const { followerId } = req.params;
  const userId = req.userId;

  const result = await followService.removeFollower(userId, followerId);

  return res.status(200).json(new ApiResponse(true, result.message, 200, null));
});

export {
  followUnfollowUser,
  getFollowers,
  getFollowing,
  isFollowing,
  removeFollower,
};
