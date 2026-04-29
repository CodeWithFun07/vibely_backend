import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.config.js";
import client from "./config/redis.config.js";
import errorHandler from "./utils/errorHandler.js";

// import routes
import userRoutes from "./routes/user.route.js";
import postRoutes from "./routes/post.route.js";
import followRoutes from "./routes/follow.route.js";
import bookmarkRoutes from "./routes/bookmark.route.js";
import commentRoutes from "./routes/comment.route.js";
import likeRoutes from "./routes/like.route.js";
import blockRoutes from "./routes/block.route.js";
import notificationRoutes from "./routes/notification.route.js";
import reportRoutes from "./routes/report.route.js";

dotenv.config();

const app = express();
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  methods:["GET", "POST", "PUT", "DELETE","PATCH"],
  allowHeaders:["Content-Type", "Authorization","multipart/form-data"],
  credentials: true,
};

console.log("CORS options:", corsOptions);

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get("/", async (req, res) => {
  res.send("Hello from the server!");
});

// User Routes
app.use("/api/v1/users", userRoutes);
// Post Routes
app.use("/api/v1/posts", postRoutes);
// Follow Routes
app.use("/api/v1/follow", followRoutes);
// Bookmark Routes
app.use("/api/v1/bookmarks", bookmarkRoutes);
// Comment Routes
app.use("/api/v1/comments", commentRoutes);
// Like Routes
app.use("/api/v1/likes", likeRoutes);
// Block Routes
app.use("/api/v1/blocks", blockRoutes);
// Notification Routes
app.use("/api/v1/notifications", notificationRoutes);
// Report Routes
app.use("/api/v1/reports", reportRoutes);

// 404 Handler - Route not found
app.use((req, res) => {
  res.status(404).json({
    statusCode: 404,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global Error Handler Middleware - MUST be last
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

connectDB()
  .then((data) => {
    if (data.connection.readyState === 1) {
      console.log("database connected successfully");
      console.log("check client url from env", process.env.CLIENT_URL);
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
        client.set("server_status", "running");
        client
          .get("server_status")
          .then((status) => {
            console.log("Server status from Redis:", status);
          })
          .catch((err) => {
            console.error("Error getting server status from Redis:", err);
          });
      });
    }
  })
  .catch((error) => {
    console.error("Failed to connect to the database:", error);
  });
