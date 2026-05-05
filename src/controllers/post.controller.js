import asyncHandler from "../utils/asyncHandler.js";
import postService from "../services/post.service.js";
import notificationService from "../services/notification.service.js";
import { emitNotificationToMultiple } from "../socket/socketEmitter.js";
import User from "../models/user.model.js";
import Follow from "../models/follow.model.js";
import ApiResponse from "../utils/apiResponse.js";
import ApiError from "../utils/apiError.js";

const createPost = asyncHandler(async (req, res) => {
  const { caption, visibility, location } = req.body;

  // Get files from multer middleware (media field)
  // Files will be in req.files.media array after uploading
  const mediaFiles = req.files?.media || [];

  const userId = req.userId;

  // Parse location if it's a JSON string
  let parsedLocation = location;
  if (location && typeof location === "string") {
    try {
      parsedLocation = JSON.parse(location);
    } catch (e) {
      parsedLocation = location;
    }
  }

  const result = await postService.createPost({
    caption,
    visibility,
    location: parsedLocation,
    media: mediaFiles,
    userId,
  });

  // Create notifications for followers (new post notification)
  try {
    // Get all followers using Follow model
    const followers = await Follow.find({ following: userId }).select("followed_by");
    if (followers && followers.length > 0) {
      const followerIds = followers.map(f => f.followed_by.toString());
      
      // Create notification for each follower
      const createdNotifications = await Promise.all(
        followers.map(follow =>
          notificationService.createNotification(
            follow.followed_by,
            userId,
            "post",
            { post: result._id }
          ).catch(err => {
            console.log("Notification error (non-critical):", err.message);
            return null;
          })
        )
      );
      
      // Emit real-time notifications to followers
      createdNotifications.forEach((notification) => {
        if (notification) {
          emitNotificationToMultiple([notification.recipient.toString()], notification);
        }
      });
    }
  } catch (error) {
    console.log("Notification error (non-critical):", error.message);
  }

  return res
    .status(201)
    .json(new ApiResponse(true, "Post created successfully", 201, result));
});

const updatePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const { caption, visibility, location, removeMediaIds } = req.body;

  // Get new media files from multer middleware
  const mediaFiles = req.files?.media || [];

  const userId = req.userId;

  // Parse location if it's a JSON string
  let parsedLocation = location;
  if (location && typeof location === "string") {
    try {
      parsedLocation = JSON.parse(location);
    } catch (e) {
      parsedLocation = location;
    }
  }

  // Parse removeMediaIds if it's a JSON string
  let parsedRemoveMediaIds = removeMediaIds || [];
  if (removeMediaIds && typeof removeMediaIds === "string") {
    try {
      parsedRemoveMediaIds = JSON.parse(removeMediaIds);
    } catch (e) {
      parsedRemoveMediaIds = [removeMediaIds]; // treat as single ID
    }
  }

  const result = await postService.updatePost({
    postId,
    caption,
    visibility,
    location: parsedLocation,
    media: mediaFiles,
    userId,
    removeMediaIds: parsedRemoveMediaIds,
  });

  return res
    .status(200)
    .json(new ApiResponse(true, "Post updated successfully", 200, result));
});

const deletePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.userId;

  const result = await postService.deletePost({
    postId,
    userId,
  });

  return res
    .status(200)
    .json(new ApiResponse(true, "Post deleted successfully", 200, result));
});

const getAllPost = asyncHandler(async (req, res) => {
  const userId = req.userId;
  
  // Get pagination parameters from query
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Validate pagination parameters
  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const search = req.query.search || "";
  const result = await postService.getAllPost(userId, page, limit, search);

  return res.status(200).json(
    new ApiResponse(true, "Posts fetched successfully", 200, {
      posts:      result.posts,
      pagination: result.pagination,
    }),
  );
});

const getPostById = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.userId;

  const result = await postService.getPostById(postId, userId);

  return res
    .status(200)
    .json(new ApiResponse(true, "Post fetched successfully", 200, result));
});

const getFollowersPost = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const result = await postService.getFollowersPost(userId, page, limit);

  return res.status(200).json(
    new ApiResponse(true, "Followers posts fetched successfully", 200, {
      posts:      result.posts,
      pagination: result.pagination,
    }),
  );
});

const getFollowingPosts = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const result = await postService.getFollowingPosts(userId, page, limit);

  return res.status(200).json(
    new ApiResponse(true, "Following posts fetched successfully", 200, {
      posts:      result.posts,
      pagination: result.pagination,
    }),
  );
});

const getCurrentUserPost = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const result = await postService.getCurrentUserPost(userId, page, limit);

  return res.status(200).json(
    new ApiResponse(true, "User posts fetched successfully", 200, {
      posts:      result.posts,
      pagination: result.pagination,
    }),
  );
});

/**
 * Get posts for a specific user's profile (public view)
 * Used when viewing another user's profile page
 */
const getUserPosts = asyncHandler(async (req, res) => {
  const { userId: profileOwnerId } = req.params;
  const viewerId = req.userId || null; // null if not logged in
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  if (page < 1) {
    throw new ApiError(400, "Page must be greater than 0");
  }
  if (limit < 1 || limit > 50) {
    throw new ApiError(400, "Limit must be between 1 and 50");
  }

  const result = await postService.getUserProfilePosts(
    profileOwnerId,
    viewerId,
    page,
    limit
  );

  return res.status(200).json(
    new ApiResponse(true, "Profile posts fetched successfully", 200, {
      posts:      result.posts,
      pagination: result.pagination,
    }),
  );
});

const bookmarkUnBookmarkPost = asyncHandler(async (req, res) => {
  const { id: postId } = req.params;
  const userId = req.userId;

  const result = await postService.bookmarkUnBookmarkPost(postId, userId);

  return res.status(200).json(
    new ApiResponse(
      true,
      result.isBookmarked ? "Post bookmarked" : "Post removed from bookmarks",
      200,
      result,
    ),
  );
});

const sharePost = asyncHandler(async (req, res) => {
  const { postId } = req.params;
  const userId = req.userId;

  const result = await postService.sharePost(postId, userId);

  return res
    .status(200)
    .json(new ApiResponse(true, "Post shared successfully", 200, result));
});

export {
  createPost,
  updatePost,
  deletePost,
  getAllPost,
  getPostById,
  getFollowersPost,
  getFollowingPosts,
  getCurrentUserPost,
  bookmarkUnBookmarkPost,
  sharePost,
  getUserPosts,
};
