// Map to store userId to socketId mapping
// Useful for sending targeted notifications
const userSocketMap = new Map();

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("⚡ user connected:", socket.id);

    // When a user logs in/connects, they send their userId
    socket.on("setup", (userId) => {
      if (userId) {
        socket.join(userId);
        userSocketMap.set(userId, socket.id);
        console.log(`👤 User ${userId} is now online`);
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
    socket.on("disconnect", () => {
      console.log("👋 User disconnected:", socket.id);
      // Remove from map
      for (const [userId, socketId] of userSocketMap.entries()) {
        if (socketId === socket.id) {
          userSocketMap.delete(userId);
          console.log(`👤 User ${userId} went offline`);
          break;
        }
      }
    });
  });
};

export default setupSocket;
export { userSocketMap };
