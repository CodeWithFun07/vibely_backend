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
      if (userId) {
        socket.join(userId);
        userSocketMap.set(userId, socket.id);
        console.log(`👤 User ${userId} is now online`);
        
        // Get followers from database and setup followers map
        try {
          const Follow = (await import("../models/follow.model.js")).default;
          const User = (await import("../models/user.model.js")).default;
          
          // Get user details to store
          const user = await User.findById(userId).select("username");
          if (user) {
            userDetailsMap.set(userId, { username: user.username });
          }
          
          const followers = await Follow.find({ following: userId }).select("followed_by");
          const followerIds = followers.map(f => f.followed_by.toString());
          
          if (followerIds.length > 0) {
            userFollowersMap.set(userId, new Set(followerIds));
          }
          
          // Broadcast online status to followers
          followerIds.forEach((followerId) => {
            io.to(followerId).emit("user status changed", {
              userId,
              username: user?.username || "A user",
              status: "online",
              timestamp: new Date(),
            });
          });
          
          console.log(`📢 Broadcasted online status to ${followerIds.length} followers`);
        } catch (error) {
          console.error("Error fetching followers:", error.message);
        }
        
        socket.emit("connected");
      }
    });

    // Join a specific chat room
    socket.on("join chat", (room) => {
      socket.join(room);
      console.log(`💬 User joined chat room: ${room}`);
    });

    // Typing indicators
    socket.on("typing", (room) => socket.in(room).emit("typing"));
    socket.on("stop typing", (room) => socket.in(room).emit("stop typing"));

    // Real-time notifications
    socket.on("new notification", (notification) => {
      const targetUserId = notification.recipient;
      if (targetUserId) {
        // Emit to the specific user's room
        socket.in(targetUserId).emit("notification received", notification);
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
          
          // Get followers and broadcast offline status
          try {
            const Follow = (await import("../models/follow.model.js")).default;
            const followers = await Follow.find({ following: userId }).select("followed_by");
            const followerIds = followers.map(f => f.followed_by.toString());
            
            // Broadcast offline status to followers
            followerIds.forEach((followerId) => {
              io.to(followerId).emit("user status changed", {
                userId,
                username: userDetails?.username || "A user",
                status: "offline",
                timestamp: new Date(),
              });
            });
            
            console.log(`📢 Broadcasted offline status to ${followerIds.length} followers`);
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
