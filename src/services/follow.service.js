import Follow from "../models/follow.model.js";
import User from "../models/user.model.js";
import Block from "../models/block.model.js";
import ApiError from "../utils/apiError.js";
import client from "../config/redis.config.js";
import { invalidateUserProfileCaches } from "../utils/cacheAside.js";

class FollowService {
  /**
   * Toggle follow/unfollow a user
   * @param {string} userId - Current user ID (who is following)
   * @param {string} targetUserId - User ID to follow/unfollow
   * @returns {Object} - { isFollowing, message }
   */
  async followUnfollowUser(userId, targetUserId) {
    // Validation
    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    if (!targetUserId) {
      throw new ApiError(400, "Target user ID is required");
    }

    // Check self-follow
    if (userId === targetUserId) {
      throw new ApiError(400, "You cannot follow yourself");
    }

    try {
      // Check if target user exists and is active
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        throw new ApiError(404, "User not found");
      }

      if (!targetUser.is_active || targetUser.isDeleted) {
        throw new ApiError(400, "This user is not available");
      }

      // Check if already following
      let followRecord = await Follow.findOne({
        followed_by: userId,
        following: targetUserId,
      });

      let isFollowing = false;

      if (!followRecord) {
        // Create new follow record
        followRecord = await Follow.create({
          followed_by: userId,
          following: targetUserId,
        });

        // Update counts
        await User.findByIdAndUpdate(userId, {
          $inc: { following_count: 1 },
        });

        await User.findByIdAndUpdate(targetUserId, {
          $inc: { followers_count: 1 },
        });

        isFollowing = true;
      } else {
        // Unfollow - delete the record
        await Follow.deleteOne({
          followed_by: userId,
          following: targetUserId,
        });

        // Decrement counts
        await User.findByIdAndUpdate(userId, {
          $inc: { following_count: -1 },
        });

        await User.findByIdAndUpdate(targetUserId, {
          $inc: { followers_count: -1 },
        });

        isFollowing = false;
      }

      // Invalidate Redis cache
      await client.del(`followers:${userId}`);
      await client.del(`following:${userId}`);
      await client.del(`followers:${targetUserId}`);
      await client.del(`following:${targetUserId}`);

      const follower = await User.findById(userId).select("username").lean();
      await invalidateUserProfileCaches(userId, follower?.username);
      await invalidateUserProfileCaches(targetUserId, targetUser.username);

      return {
        isFollowing,
        message: isFollowing
          ? "User followed successfully"
          : "User unfollowed successfully",
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to follow/unfollow user: ${error.message}`);
    }
  }

  async getFollowers(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const cacheKey = `followers:${userId}:${page}:${limit}`;
      const cachedData = await client.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }
      
      const skip = (page - 1) * limit;

      // Get blocked users (users that blocked current user OR users current user blocked)
      const blockedRecords = await Block.find({
        $or: [
          { blocked_by: userId }, // Users I blocked
          { blocked_user: userId }, // Users who blocked me
        ],
        isActive: true,
      });

      // Create set of blocked user IDs
      const blockedUserIds = new Set();
      blockedRecords.forEach((record) => {
        blockedUserIds.add(record.blocked_by.toString());
        blockedUserIds.add(record.blocked_user.toString());
      });

      // Get all followers (who follow current user)
      const followers = await Follow.find({
        following: userId,
      })
        .populate({
          path: "followed_by",
          match: {
            is_active: true,
            is_banned: false,
            isDeleted: false,
          },
          select:
            "_id username email profile.full_name profile.profile_picture followers_count following_count",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Filter out null results and blocked users
      const validFollowers = followers
        .filter((f) => f.followed_by !== null && !blockedUserIds.has(f.followed_by._id.toString()))
        .map((f) => f.followed_by);

      // Get total count
      const totalFollowers = await Follow.countDocuments({
        following: userId,
      });

      const totalPages = Math.ceil(totalFollowers / limit);

      const result = {
        followers: validFollowers,
        pagination: {
          currentPage: page,
          totalPages,
          totalFollowers,
          followersPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };

      // Store in Redis for 5 minutes
      await client.set(cacheKey, JSON.stringify(result), { EX: 300 });

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch followers: ${error.message}`);
    }
  }

  /**
   * Get users that current user is following
   * @param {string} userId - Current user ID
   * @param {number} page - Page number
   * @param {number} limit - Items per page
   * @returns {Object} - { following, pagination }
   */
  async getFollowing(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const cacheKey = `following:${userId}:${page}:${limit}`;
      const cachedData = await client.get(cacheKey);
      if (cachedData) {
        return JSON.parse(cachedData);
      }

      const skip = (page - 1) * limit;

      // Get blocked users (users that blocked current user OR users current user blocked)
      const blockedRecords = await Block.find({
        $or: [
          { blocked_by: userId }, // Users I blocked
          { blocked_user: userId }, // Users who blocked me
        ],
        isActive: true,
      });

      // Create set of blocked user IDs
      const blockedUserIds = new Set();
      blockedRecords.forEach((record) => {
        blockedUserIds.add(record.blocked_by.toString());
        blockedUserIds.add(record.blocked_user.toString());
      });

      // Get all users current user is following
      const following = await Follow.find({
        followed_by: userId,
      })
        .populate({
          path: "following",
          match: {
            is_active: true,
            is_banned: false,
            isDeleted: false,
          },
          select:
            "_id username email profile.full_name profile.profile_picture followers_count following_count",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      // Filter out null results and blocked users
      const validFollowing = following
        .filter((f) => f.following !== null && !blockedUserIds.has(f.following._id.toString()))
        .map((f) => f.following);

      // Get total count
      const totalFollowing = await Follow.countDocuments({
        followed_by: userId,
      });

      const totalPages = Math.ceil(totalFollowing / limit);

      const result = {
        following: validFollowing,
        pagination: {
          currentPage: page,
          totalPages,
          totalFollowing,
          followingPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };

      // Store in Redis for 5 minutes
      await client.set(cacheKey, JSON.stringify(result), { EX: 300 });

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch following: ${error.message}`);
    }
  }

  /**
   * Check if current user is following a specific user
   * @param {string} userId - Current user ID
   * @param {string} targetUserId - User to check
   * @returns {Object} - { isFollowing }
   */
  async isFollowing(userId, targetUserId) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    if (!targetUserId) {
      throw new ApiError(400, "Target user ID is required");
    }

    try {
      const follow = await Follow.findOne({
        followed_by: userId,
        following: targetUserId,
      });

      return {
        isFollowing: !!follow,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to check following status: ${error.message}`);
    }
  }

  /**
   * Remove a follower (allow user to remove followers)
   * @param {string} userId - Current user ID (whose follower to remove)
   * @param {string} followerId - Follower ID to remove
   * @returns {Object} - { message }
   */
  async removeFollower(userId, followerId) {
    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    if (!followerId) {
      throw new ApiError(400, "Follower ID is required");
    }

    if (userId === followerId) {
      throw new ApiError(400, "Cannot remove yourself");
    }

    try {
      // Find and delete the follow record
      const follow = await Follow.findOneAndDelete({
        followed_by: followerId,
        following: userId,
      });

      if (!follow) {
        throw new ApiError(404, "This user is not following you");
      }

      // Update counts
      await User.findByIdAndUpdate(followerId, {
        $inc: { following_count: -1 },
      });

      await User.findByIdAndUpdate(userId, {
        $inc: { followers_count: -1 },
      });

      return {
        message: "Follower removed successfully",
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to remove follower: ${error.message}`);
    }
  }
}

const followService = new FollowService();

export default followService;
