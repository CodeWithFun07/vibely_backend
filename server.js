
import { server } from "./src/app.js";
import connectDB from "./src/config/db.config.js";
import client from "./src/config/redis.config.js";

const PORT = process.env.PORT || 5000;

// Connect to Database and start server
connectDB()
  .then((data) => {
    if (data.connection.readyState === 1) {
      console.log("Database connected successfully");
      
      // Start listening on the HTTP Server (CRITICAL: use server.listen for Socket.io)
      server.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        console.log("Client URL:", process.env.CLIENT_URL);
        
        // Initialize Redis status if client is available
        if (client) {
          client.set("server_status", "running")
            .then(() => client.get("server_status"))
            .then((status) => console.log("Redis server status:", status))
            .catch((err) => console.error("Redis status error:", err));
        }
      });
    }
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
    process.exit(1);
  });
