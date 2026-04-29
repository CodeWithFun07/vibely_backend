import Block from "../models/block.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";

class BlockService {
  /**
   * Block or unblock a user
   * @param {string} userId - Current user ID
   * @param {string} blockUserId - User to block/unblock
   * @returns {Object} - { isBlocked, message }
   */
  async toggleBlock(userId, blockUserId) {
    if (!userId) {
      throw new ApiError(401, "User ID is required");
    }

    if (!blockUserId) {
      throw new ApiError(400, "User to block ID is required");
    }

    if (userId === blockUserId) {
      throw new ApiError(400, "You cannot block yourself");
    }

    try {
      // Check if user exists
      const user = await User.findById(blockUserId);
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      let block = await Block.findOne({
        blocked_by: userId,
        blocked_user: blockUserId,
      });

      let isBlocked = false;

      if (!block) {
        // Create block
        await Block.create({
          blocked_by: userId,
          blocked_user: blockUserId,
          isActive: true,
        });
        isBlocked = true;
      } else if (block.isActive) {
        // Unblock
        block.isActive = false;
        await block.save();
        isBlocked = false;
      } else {
        // Reblock
        block.isActive = true;
        await block.save();
        isBlocked = true;
      }

      return {
        isBlocked,
        message: isBlocked ? "User blocked successfully" : "User unblocked successfully",
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to toggle block: ${error.message}`);
    }
  }

  /**
   * Get list of blocked users
   * @param {string} userId - Current user ID
   * @param {number} page - Page number
   * @param {number} limit - Users per page
   * @returns {Object} - { blockedUsers, pagination }
   */
  async getBlockedUsers(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const skip = (page - 1) * limit;

      const blocks = await Block.find({
        blocked_by: userId,
        isActive: true,
      })
        .populate(
          "blocked_user",
          "_id username email profile.full_name profile.profile_picture followers_count",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const blockedUsers = blocks.map((block) => block.blocked_user);

      const totalBlocked = await Block.countDocuments({
        blocked_by: userId,
        isActive: true,
      });

      const totalPages = Math.ceil(totalBlocked / limit);

      return {
        blockedUsers,
        pagination: {
          currentPage: page,
          totalPages,
          totalBlocked,
          blockedPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch blocked users: ${error.message}`);
    }
  }

  /**
   * Check if user is blocked
   * @param {string} userId - Current user ID
   * @param {string} checkUserId - User to check
   * @returns {Object} - { isBlocked }
   */
  async isBlocked(userId, checkUserId) {
    if (!userId || !checkUserId) {
      throw new ApiError(400, "User IDs are required");
    }

    try {
      const block = await Block.findOne({
        blocked_by: userId,
        blocked_user: checkUserId,
        isActive: true,
      });

      return { isBlocked: !!block };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to check block status: ${error.message}`);
    }
  }

  /**
   * Check if user is blocked by someone (reverse check)
   * @param {string} userId - User ID
   * @param {string} checkUserId - Check if blocked by this user
   * @returns {Object} - { isBlockedBy }
   */
  async isBlockedBy(userId, checkUserId) {
    if (!userId || !checkUserId) {
      throw new ApiError(400, "User IDs are required");
    }

    try {
      const block = await Block.findOne({
        blocked_by: checkUserId,
        blocked_user: userId,
        isActive: true,
      });

      return { isBlockedBy: !!block };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to check block status: ${error.message}`);
    }
  }
}

const blockService = new BlockService();
export default blockService;
