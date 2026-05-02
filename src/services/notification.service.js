import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import ApiError from "../utils/apiError.js";

class NotificationService {
  /**
   * Create a notification
   * @param {string} recipientId - Recipient user ID
   * @param {string} senderId - Sender user ID
   * @param {string} type - Notification type (like, comment, follow, etc.)
   * @param {Object} options - Additional options { post, comment, chat, message, action_url }
   * @returns {Object} - Created notification or null if user disabled this type
   */
  async createNotification(recipientId, senderId, type, options = {}) {
    if (!recipientId || !senderId || !type) {
      throw new ApiError(400, "Recipient, Sender, and Type are required");
    }

    if (
      ![
        "like",
        "comment",
        "follow",
        "reply",
        "mention",
        "message",
        "post",
      ].includes(type)
    ) {
      throw new ApiError(400, "Invalid notification type");
    }

    try {
      // Check user's notification preferences
      const recipient = await User.findById(recipientId);
      if (!recipient) {
        throw new ApiError(404, "Recipient not found");
      }

      // Initialize notification_preferences if not exist (for legacy users)
      if (!recipient.notification_preferences) {
        recipient.notification_preferences = {
          likes: true,
          comments: true,
          follows: true,
          mentions: true,
          posts: true,
          messages: true,
        };
        await recipient.save();
      }

      // Map notification type to preference field
      const preferenceMap = {
        like: "likes",
        comment: "comments",
        follow: "follows",
        reply: "comments", // Replies treated as comments
        mention: "mentions",
        message: "messages",
        post: "posts",
      };

      const preferenceField = preferenceMap[type];
      const isEnabled =
        recipient.notification_preferences?.[preferenceField] !== false;

      // If preference is disabled, silently skip notification creation
      if (!isEnabled) {
        return null;
      }

      // Generate notification message based on type
      let notificationMessage = options.message || "";
      if (!notificationMessage) {
        const sender = await User.findById(senderId).select("username");
        const messageMap = {
          like: `${sender?.username || "Someone"} liked your post`,
          comment: `${sender?.username || "Someone"} commented on your post`,
          follow: `${sender?.username || "Someone"} followed you`,
          reply: `${sender?.username || "Someone"} replied to your comment`,
          mention: `mentioned you in a ${options.comment ? "comment" : "post"}`,
          message: options.message || "You have a new message",
          post: `${sender?.username || "Someone"} posted something`,
        };
        notificationMessage = messageMap[type] || "";
      }

      const notification = await Notification.create({
        recipient: recipientId,
        sender: senderId,
        type,
        post: options.post || null,
        comment: options.comment || null,
        chat: options.chat || null,
        message: notificationMessage,
        action_url: options.action_url || null,
      });

      // Populate sender data for real-time notifications
      const populatedNotification = await Notification.findById(notification._id)
        .populate('sender', 'username profile.profile_picture')
        .populate('post', 'content')
        .populate('comment', 'content');

      return populatedNotification;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Failed to create notification: ${error.message}`,
      );
    }
  }

  /**
   * Get notifications for a user
   * @param {string} userId - User ID
   * @param {number} page - Page number
   * @param {number} limit - Notifications per page
   * @param {string} status - Filter by status (unread, read, archived, all)
   * @returns {Object} - { notifications, pagination, unreadCount }
   */
  async getNotifications(userId, page = 1, limit = 10, status = "unread") {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const skip = (page - 1) * limit;

      // Build query
      const query = {
        recipient: userId,
        isDeleted: false,
      };

      if (status !== "all") {
        query.status = status;
      }

      const notifications = await Notification.find(query)
        .populate(
          "sender",
          "_id username email profile.full_name profile.profile_picture",
        )
        .populate("post", "_id caption")
        .populate("comment", "_id content")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const totalNotifications = await Notification.countDocuments(query);
      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        status: "unread",
        isDeleted: false,
      });

      const totalPages = Math.ceil(totalNotifications / limit);

      return {
        notifications,
        pagination: {
          currentPage: page,
          totalPages,
          totalNotifications,
          notificationsPerPage: limit,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        unreadCount,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Failed to fetch notifications: ${error.message}`,
      );
    }
  }

  /**
   * Mark notification as read
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (verify ownership)
   * @returns {Object} - Updated notification
   */
  async markAsRead(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new ApiError(400, "Notification ID and User ID are required");
    }

    try {
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        throw new ApiError(404, "Notification not found");
      }

      if (notification.recipient.toString() !== userId) {
        throw new ApiError(403, "You can only mark your own notifications");
      }

      notification.status = "read";
      notification.isRead = true;
      notification.read_at = new Date();

      await notification.save();

      return notification;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to mark notification as read: ${error.message}`);
    }
  }

  /**
   * Mark all notifications as read
   * @param {string} userId - User ID
   * @returns {Object} - { message, count }
   */
  async markAllAsRead(userId) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const result = await Notification.updateMany(
        {
          recipient: userId,
          status: "unread",
          isDeleted: false,
        },
        {
          status: "read",
          isRead: true,
          read_at: new Date(),
        },
      );

      return {
        message: "All notifications marked as read",
        count: result.modifiedCount,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Failed to mark all notifications as read: ${error.message}`,
      );
    }
  }

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID (verify ownership)
   * @returns {Object} - { message }
   */
  async deleteNotification(notificationId, userId) {
    if (!notificationId || !userId) {
      throw new ApiError(400, "Notification ID and User ID are required");
    }

    try {
      const notification = await Notification.findById(notificationId);

      if (!notification) {
        throw new ApiError(404, "Notification not found");
      }

      if (notification.recipient.toString() !== userId) {
        throw new ApiError(403, "You can only delete your own notifications");
      }

      notification.isDeleted = true;
      await notification.save();

      return { message: "Notification deleted successfully" };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Failed to delete notification: ${error.message}`,
      );
    }
  }

  /**
   * Clear all notifications
   * @param {string} userId - User ID
   * @returns {Object} - { message, count }
   */
  async clearAllNotifications(userId) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const result = await Notification.updateMany(
        {
          recipient: userId,
          isDeleted: false,
        },
        {
          isDeleted: true,
        },
      );

      return {
        message: "All notifications cleared",
        count: result.modifiedCount,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Failed to clear notifications: ${error.message}`,
      );
    }
  }

  /**
   * Get unread notification count
   * @param {string} userId - User ID
   * @returns {Object} - { unreadCount }
   */
  async getUnreadCount(userId) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const unreadCount = await Notification.countDocuments({
        recipient: userId,
        status: "unread",
        isDeleted: false,
      });

      return { unreadCount };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        500,
        `Failed to fetch unread count: ${error.message}`,
      );
    }
  }

  /**
   * Notify mentioned users
   * @param {Array<string>} userIds - User IDs mentioned
   * @param {string} senderId - User ID who mentioned them
   * @param {Object} options - { post, comment }
   */
  async notifyMentions(userIds, senderId, options = {}) {
    if (!userIds || userIds.length === 0) return;

    console.log(`Notifying ${userIds.length} mentioned users from sender ${senderId}`);

    const promises = userIds
      .filter((id) => id !== senderId) // Don't notify yourself
      .map((recipientId) => {
        console.log(`Creating mention notification for ${recipientId}`);
        return this.createNotification(recipientId, senderId, "mention", options).catch(
          (err) => console.error("Mention notification error:", err.message),
        );
      });

    await Promise.all(promises);
  }
}

const notificationService = new NotificationService();
export default notificationService;
