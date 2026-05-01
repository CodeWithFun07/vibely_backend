import { Router } from "express";
import {
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
} from "../controllers/post.controller.js";
import isAuthenticated from "../middlewares/auth.middleware.js";
import { uploadMultipleFiles } from "../middlewares/multer.js";

const route = Router();

/**
 * create post
 * update post
 * delete post
 * share post
 * favorite/unfavorite post
 * get all post
 * get current user post
 * get post by id
 * get follower posts
 * get following posts
 */

// Create post with media upload - max 10 files
route
  .route("/create")
  .post(isAuthenticated, uploadMultipleFiles("media", 10), createPost);

route.route("/").get(isAuthenticated, getAllPost);

route.route("/follower/post").get(isAuthenticated, getFollowersPost);

route.route("/following/post").get(isAuthenticated, getFollowingPosts);

route.route("/user").get(isAuthenticated, getCurrentUserPost);

route
  .route("/update/:postId")
  .put(isAuthenticated, uploadMultipleFiles("media", 10), updatePost);

route.route("/delete/:postId").delete(isAuthenticated, deletePost);

route
  .route("/bookmark/unbookmark/:id")
  .put(isAuthenticated, bookmarkUnBookmarkPost);

route.route("/share/:postId").post(isAuthenticated, sharePost);

// Get posts for a specific user's profile (public view)
route.route("/user/:userId").get(isAuthenticated, getUserPosts);

// This must be last - catch-all for /:postId
route.route("/:postId").get(isAuthenticated, getPostById);

export default route;
