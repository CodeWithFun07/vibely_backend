/**
 * Socket Emitter Utility
 * ========================
 * 
 * This utility allows controllers to emit real-time notifications via Socket.IO
 * without directly accessing the io instance.
 * 
 * How it works:
 * - registerIO(io): Called once when server starts to register the io instance
 * - emitNotification(recipientId, notification): Emits notification to specific user
 * - broadcastOnlineStatus(userId, status, followers): Broadcasts online/offline to followers
 */

let io = null;

/**
 * Register the Socket.IO instance
 * Call this once from the main app.js when socket is initialized
 */
export const registerIO = (ioInstance) => {
  io = ioInstance;
  console.log("✅ Socket.IO instance registered for emitter");
};

/**
 * Emit a notification to a specific recipient
 * @param {string} recipientId - User ID of the recipient
 * @param {Object} notification - Notification object from database
 */
export const emitNotification = (recipientId, notification) => {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized. Cannot emit notification.");
    return;
  }

  try {
    // Emit to the recipient's room (which is their userId)
    io.to(recipientId).emit("notification received", notification);
    console.log(`📤 Notification emitted to user ${recipientId} ${notification}`);
  } catch (error) {
    console.error("Error emitting notification:", error);
  }
};

/**
 * Broadcast online/offline status to user's followers
 * @param {string} userId - User who came online/offline
 * @param {string} status - "online" or "offline"
 * @param {Array} followerIds - Array of follower user IDs
 */
export const broadcastOnlineStatus = (userId, status, followerIds = []) => {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized. Cannot broadcast online status.");
    return;
  }

  try {
    const message = {
      userId,
      status,
      timestamp: new Date(),
    };

    // Emit to each follower's room
    followerIds.forEach((followerId) => {
      io.to(followerId).emit("user status changed", message);
    });

    console.log(
      `👥 Online status (${status}) broadcasted for user ${userId} to ${followerIds.length} followers`
    );
  } catch (error) {
    console.error("Error broadcasting online status:", error);
  }
};

/**
 * Emit multiple notifications (e.g., to all followers)
 * @param {Array} recipientIds - Array of user IDs
 * @param {Object} notification - Notification object
 */
export const emitNotificationToMultiple = (recipientIds, notification) => {
  if (!io) {
    console.warn(
      "⚠️ Socket.IO not initialized. Cannot emit notifications."
    );
    return;
  }

  try {
    recipientIds.forEach((recipientId) => {
      io.to(recipientId).emit("notification received", notification);
    });
    console.log(
      `📤 Notification emitted to ${recipientIds.length} users`
    );
  } catch (error) {
    console.error("Error emitting notifications to multiple users:", error);
  }
};

export default { registerIO, emitNotification, broadcastOnlineStatus, emitNotificationToMultiple };
