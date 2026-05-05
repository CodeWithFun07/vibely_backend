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

/** Plain object for Socket.IO JSON (avoids circular refs / odd Mongoose serialization). */
const toSocketPayload = (doc) => {
  if (doc == null) return doc;
  if (typeof doc.toObject === "function") {
    return doc.toObject({ flattenMaps: true });
  }
  return doc;
};

const idToString = (id) => {
  if (id == null) return id;
  if (typeof id === "string") return id;
  if (typeof id === "object" && typeof id.$oid === "string") return id.$oid;
  if (typeof id === "object" && typeof id.toHexString === "function")
    return id.toHexString();
  return String(id);
};

/** So clients always get string ids (fixes realtime + React Query keys). */
const normalizeMessageForSocket = (message) => {
  const p = toSocketPayload(message);
  if (!p || typeof p !== "object") return p;
  const m = { ...p };
  if (m.chat_id != null) m.chat_id = idToString(m.chat_id);
  if (m.sender && typeof m.sender === "object" && m.sender._id != null) {
    m.sender = { ...m.sender, _id: idToString(m.sender._id) };
  } else if (m.sender != null && typeof m.sender !== "object") {
    m.sender = idToString(m.sender);
  }
  if (m.reply_to && typeof m.reply_to === "object") {
    const r = { ...m.reply_to };
    if (r._id != null) r._id = idToString(r._id);
    if (r.sender && typeof r.sender === "object" && r.sender._id != null) {
      r.sender = { ...r.sender, _id: idToString(r.sender._id) };
    }
    m.reply_to = r;
  }
  return m;
};

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
    const rid = String(recipientId);
    const payload = toSocketPayload(notification);
    io.to(rid).emit("notification received", payload);
    console.log(`📤 Notification emitted to user ${rid}`);
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
    const payload = toSocketPayload(notification);
    recipientIds.forEach((recipientId) => {
      io.to(String(recipientId)).emit("notification received", payload);
    });
    console.log(
      `📤 Notification emitted to ${recipientIds.length} users`
    );
  } catch (error) {
    console.error("Error emitting notifications to multiple users:", error);
  }
};

export const emitMessageToChat = (chatId, message) => {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized. Cannot emit chat message.");
    return;
  }

  try {
    const payload = normalizeMessageForSocket(message);
    io.to(String(chatId)).emit("message received", payload);
    console.log(`📩 Message emitted to chat room ${chatId}`);
  } catch (error) {
    console.error("Error emitting chat message:", error);
  }
};

export const emitMessageToParticipants = (participantIds, message) => {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized. Cannot emit message to participants.");
    return;
  }

  try {
    const payload = normalizeMessageForSocket(message);
    participantIds.forEach((id) => {
      io.to(String(id)).emit("message received", payload);
    });
    console.log(`📩 Message emitted to ${participantIds.length} participants`);
  } catch (error) {
    console.error("Error emitting message to participants:", error);
  }
};

/**
 * When a message is deleted for everyone (or similarly patched), notify everyone in the chat room.
 */
export const emitChatMessageMutation = (chatId, payload) => {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized. Cannot emit message mutation.");
    return;
  }
  try {
    const cid = String(chatId || "");
    if (!cid) return;

    // Normalize message if present in payload
    if (payload.message) {
      payload.message = normalizeMessageForSocket(payload.message);
    }

    io.to(cid).emit("message mutated", payload);
    console.log(`🔄 Message mutation (${payload.type}) emitted to chat room ${cid}`);
  } catch (error) {
    console.error("Error emitting message mutated:", error);
  }
};

export const emitMessageSeen = (chatId, seenPayload) => {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized. Cannot emit message seen update.");
    return;
  }

  try {
    io.to(chatId.toString()).emit("message seen", seenPayload);
    console.log(`👀 Message seen update emitted to chat room ${chatId}`);
  } catch (error) {
    console.error("Error emitting message seen update:", error);
  }
};

export const emitChatCreated = (recipientIds, chat) => {
  if (!io) {
    console.warn("⚠️ Socket.IO not initialized. Cannot emit chat created event.");
    return;
  }

  try {
    recipientIds.forEach((recipientId) => {
      io.to(recipientId.toString()).emit("chat created", chat);
    });
    console.log(`🆕 Chat created event emitted to ${recipientIds.length} users`);
  } catch (error) {
    console.error("Error emitting chat created event:", error);
  }
};

export default {
  registerIO,
  emitNotification,
  broadcastOnlineStatus,
  emitNotificationToMultiple,
  emitMessageToChat,
  emitMessageToParticipants,
  emitChatMessageMutation,
  emitMessageSeen,
  emitChatCreated,
};
