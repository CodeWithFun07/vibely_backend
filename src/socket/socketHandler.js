// Map to store userId to socketId mapping
// Useful for sending targeted notifications
const userSocketMap = new Map();

// Map to store followers for each user (userId -> Set of followerIds)
const userFollowersMap = new Map();

// Map to store user details (userId -> { username, ... })
const userDetailsMap = new Map();

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("⚡ user connected:", socket.id);

    // When a user logs in/connects, they send their userId
    socket.on("setup", async (userId) => {
      const uid = userId != null ? String(userId) : "";
      if (uid) {
        socket.data.userId = uid;
        socket.join(uid);
        userSocketMap.set(uid, socket.id);
        console.log(`👤 User ${uid} is now online`);
        
        // Update user's is_online status in database
        try {
          const User = (await import("../models/user.model.js")).default;
          await User.findByIdAndUpdate(
            uid,
            {
              is_online: true,
              last_seen: null, // Clear last_seen when user is online
            },
            { new: true }
          );
          console.log(`✅ Updated is_online for user ${uid}`);
        } catch (dbError) {
          console.error("Error updating user is_online:", dbError.message);
        }
        
        // Get followers from database and setup followers map
        try {
          const Follow = (await import("../models/follow.model.js")).default;
          const User = (await import("../models/user.model.js")).default;
          
          // Get user details to store
          const user = await User.findById(uid).select("username is_active");
          if (user && user.is_active) { // Only broadcast if user is active
            userDetailsMap.set(uid, { username: user.username });
            
            // Get all chats user is part of to notify participants
            const Chat = (await import("../models/chat.model.js")).default;
            const chats = await Chat.find({ participants: uid }).select("participants");
            const notifyIds = new Set();
            
            // Add participants from chats and JOIN CHAT ROOMS
            chats.forEach(c => {
              const cid = String(c._id);
              socket.join(cid);
              console.log(`📡 User ${uid} joined room: ${cid}`);
              c.participants.forEach(p => {
                if (p.toString() !== uid) notifyIds.add(p.toString());
              });
            });
            
            // Also add followers to be safe
            const followers = await Follow.find({ following: uid }).select("followed_by");
            followers.forEach(f => notifyIds.add(f.followed_by.toString()));
            
            // Broadcast online status
            notifyIds.forEach((targetId) => {
              io.to(targetId).emit("user status changed", {
                userId: uid,
                username: user?.username || "A user",
                status: "online",
                timestamp: new Date(),
              });
            });
            
            console.log(`📢 Broadcasted online status to ${notifyIds.size} users`);
          }
        } catch (error) {
          console.error("Error fetching followers:", error.message);
        }
        
        socket.emit("connected");
      }
    });

    // Join a specific chat room
    socket.on("join chat", (room) => {
      if (room == null || room === "") return;
      const roomId = String(room);
      socket.join(roomId);
      console.log(`💬 User joined chat room: ${roomId}`);
    });

    // Typing indicators — forward { room, userId } so clients can filter and ignore self
    socket.on("typing", (payload) => {
      const room =
        typeof payload === "string"
          ? payload
          : payload?.room != null
            ? String(payload.room)
            : "";
      if (!room) return;
      const fromUserId = socket.data.userId || null;
      const username = fromUserId
        ? userDetailsMap.get(fromUserId)?.username
        : undefined;
      socket.to(room).emit("typing", {
        room,
        userId: fromUserId,
        username: username || "Someone",
      });
    });

    socket.on("stop typing", (payload) => {
      const room =
        typeof payload === "string"
          ? payload
          : payload?.room != null
            ? String(payload.room)
            : "";
      if (!room) return;
      const fromUserId = socket.data.userId || null;
      const username = fromUserId
        ? userDetailsMap.get(fromUserId)?.username
        : undefined;
      socket.to(room).emit("stop typing", {
        room,
        userId: fromUserId,
        username: username || "Someone",
      });
    });

    // Optional client relay — prefer server emitNotification from controllers
    socket.on("new notification", (notification) => {
      const raw = notification?.recipient;
      const targetUserId =
        raw != null && typeof raw === "object" && raw.toString
          ? String(raw)
          : raw != null
            ? String(raw)
            : "";
      if (targetUserId) {
        io.to(targetUserId).emit("notification received", notification);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log("👋 User disconnected:", socket.id);
      
      // Find and remove user from map
      let disconnectedUserId = null;
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          disconnectedUserId = userId;
          const userDetails = userDetailsMap.get(userId);
          console.log(`👤 User ${userId} went offline`);
          
          // Update user's last_seen and is_online status in database
          try {
            const User = (await import("../models/user.model.js")).default;
            await User.findByIdAndUpdate(
              userId,
              {
                is_online: false,
                last_seen: new Date(),
              },
              { new: true }
            );
            console.log(`✅ Updated last_seen for user ${userId}`);
          } catch (dbError) {
            console.error("Error updating user last_seen:", dbError.message);
          }
          
          // Get followers and broadcast offline status
          // Get all chats user is part of to notify participants
          try {
            const Chat = (await import("../models/chat.model.js")).default;
            const Follow = (await import("../models/follow.model.js")).default;
            
            const chats = await Chat.find({ participants: userId }).select("participants");
            const notifyIds = new Set();
            
            chats.forEach(c => {
              c.participants.forEach(p => {
                if (p.toString() !== userId) notifyIds.add(p.toString());
              });
            });
            
            const followers = await Follow.find({ following: userId }).select("followed_by");
            followers.forEach(f => notifyIds.add(f.followed_by.toString()));
            
            // Broadcast offline status
            notifyIds.forEach((targetId) => {
              io.to(targetId).emit("user status changed", {
                userId,
                username: userDetails?.username || "A user",
                status: "offline",
                timestamp: new Date(),
              });
            });
            
            console.log(`📢 Broadcasted offline status to ${notifyIds.size} users`);
          } catch (error) {
            console.error("Error broadcasting offline status:", error.message);
          }
          
          // Clear followers map for this user
          userFollowersMap.delete(userId);
          userDetailsMap.delete(userId);
          
          break;
        }
      }
    });
  });
};

export default setupSocket;
export { userSocketMap, userFollowersMap, userDetailsMap };
