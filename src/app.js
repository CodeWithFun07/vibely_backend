import express from "express";
import http from "http";
import cookieParser from "cookie-parser";
import cors from "cors";
import errorHandler from "./utils/errorHandler.js";
import { Server } from "socket.io";
import setupSocket from "./socket/socketHandler.js";
import { registerIO } from "./socket/socketEmitter.js";


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

const app = express();
const server = http.createServer(app);

const whitelist = ["http://localhost:5173", process.env.CLIENT_URL].filter(
  Boolean,
);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || whitelist.includes(origin)) {
      callback(null, true);
    } else {
      console.log("CORS blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || whitelist.includes(origin)) {
        callback(null, true);
      } else {
        console.log("Socket.IO CORS blocked origin:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
});

setupSocket(io);
registerIO(io);

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get("/", (req, res) => {
  res.send("Hello from Vibely Server!");
});

// API Routes
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/posts", postRoutes);
app.use("/api/v1/follow", followRoutes);
app.use("/api/v1/bookmarks", bookmarkRoutes);
app.use("/api/v1/comments", commentRoutes);
app.use("/api/v1/likes", likeRoutes);
app.use("/api/v1/blocks", blockRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/v1/reports", reportRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    statusCode: 404,
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global Error Handler
app.use(errorHandler);

export { app, server, io };
