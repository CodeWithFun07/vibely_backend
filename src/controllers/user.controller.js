import { userService } from "../services/user.service.js";
import postService from "../services/post.service.js";
import ApiResponse from "../utils/apiResponse.js";
import asyncHandler from "../utils/asyncHandler.js";

// signup
const signup = asyncHandler(async (req, res) => {
  const { email, username, phone_number, password } = req.body;

  const result = await userService.signup({
    email,
    username,
    phone_number,
    password,
  });

  return res
    .status(200)
    .json(
      new ApiResponse(
        true,
        "Signup successful. Please verify your email.",
        200,
        result,
      ),
    );
});

// verify signup
const verifySignup = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const result = await userService.verifySignup({ email, otp });

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return res.status(200).json(
    new ApiResponse(true, result.message, 200, {
      accessToken: result.accessToken,
    }),
  );
});

// login user
const login = asyncHandler(async (req, res) => {
  const { email, username, phone_number, password } = req.body;

  const identifier = email || username || phone_number;

  const result = await userService.login({
    identifier,
    password,
  });

  res.cookie("refreshToken", result.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  res.status(200).json(
    new ApiResponse(true, "Login successful", 200, {
      accessToken: result.accessToken,
    }),
  );
});

// resend otp
const resendOtp = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const result = await userService.resendOtp({ email });

  return res.status(200).json(new ApiResponse(true, result.message, 200, null));
});

// forgot password
const forgotPassword = asyncHandler(async (req, res) => {
  const { email, phone_number, username } = req.body;

  const identifier = email || phone_number || username;

  const result = await userService.forgotPassword(identifier);

  return res.status(200).json(
    new ApiResponse(true, result.message, 200, {
      email: result.email,
    }),
  );
});

// verify forgot password
const verifyForgotPassword = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  const result = await userService.verifyForgotPassword({ email, otp });

  return res.status(200).json(
    new ApiResponse(true, result.message, 200, {
      resetToken: result.resetToken,
    }),
  );
});

// reset password
const resetPassword = asyncHandler(async (req, res) => {
  const { email, new_password } = req.body;

  const result = await userService.resetPassword({ email, new_password });

  return res.status(200).json(new ApiResponse(true, result.message, 200, null));
});

// update password
const updatePassword = asyncHandler(async (req, res) => {
  const userId = req.userId; // Assuming userId is added to req.user by auth middleware
  const { old_password, new_password,confirm_password } = req.body;

  const result = await userService.updatePassword({
    userId,
    old_password,
    new_password,
    confirm_password
  });

  return res.status(200).json(new ApiResponse(true, result.message, 200, null));
});

// update profile
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const { full_name, bio, address, username, phone_number, website, gender, is_private } = req.body;
  // Now uses uploadMultipleFiles so both files land in req.files
  const profile_picture = req.files?.profile_picture?.[0] || null;
  const cover_picture   = req.files?.cover_picture?.[0]   || null;

  const result = await userService.updateProfile({
    userId,
    full_name,
    bio,
    address,
    profile_picture,
    cover_picture,
    username,
    phone_number,
    website,
    gender,
    is_private: is_private === "true" || is_private === true,
  });

  return res
    .status(200)
    .json(new ApiResponse(true, result.message, 200, result.user));
});

// deactive user
const deactiveUser = asyncHandler(async (req, res) => {
  const userId = req.userId; // Assuming userId is added to req.user by auth middleware

  const result = await userService.deactiveUser({ userId });

  res.clearCookie("refreshToken");

  return res.status(200).json(new ApiResponse(true, result.message, 200, null));
});

// activate user
const activateUser = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const result = await userService.activateUser(userId);

  return res.status(200).json(
    new ApiResponse(true, result.message, 200, {
      email: result.email,
    }),
  );
});

// verify user activation
const verifyUserActivation = asyncHandler(async (req, res) => {
  const { otp } = req.body;
  const userId = req.userId;

  const result = await userService.verifyUserActivation({ userId, otp });

  return res.status(200).json(new ApiResponse(true, result.message, 200, null));
});

// update privacy settings
const updatePrivacySettings = asyncHandler(async (req, res) => {
  const userId = req.userId; // Assuming userId is added to req.user by auth middleware
  const {
    allow_follow,
    is_private,
    message_privacy,
    who_can_see_followers,
    who_can_see_following,
  } = req.body;

  const result = await userService.updatePrivacySettings({
    userId,
    allow_follow,
    is_private,
    message_privacy,
    who_can_see_followers,
    who_can_see_following,
  });

  return res
    .status(200)
    .json(new ApiResponse(true, result.message, 200, result.settings));
});

// refresh access token
const renewAccessToken = asyncHandler(async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  const result = await userService.refreshAccessToken(refreshToken);

  return res.status(200).json(
    new ApiResponse(true, result.message, 200, {
      accessToken: result.accessToken,
    }),
  );
});

const logout = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const result = await userService.logout(userId);

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res.status(200).json(new ApiResponse(true, result.message, 200, null));
});

const getMyProfile = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const result = await userService.getMyProfile(userId);

  return res
    .status(200)
    .json(new ApiResponse(true, result.message, 200, result.user));
});

const getUserProfile = asyncHandler(async (req, res) => {
  const { identifier } = req.params; // userId or username

  const result = await userService.getUserProfile(identifier, req.userId);

  return res
    .status(200)
    .json(new ApiResponse(true, result.message, 200, result.user));
});

const searchUsers = asyncHandler(async (req, res) => {
  const { query, page = 1, limit = 10 } = req.query;
  const currentUserId = req.userId;

  const result = await userService.searchUsers(
    query,
    currentUserId,
    parseInt(page),
    parseInt(limit),
  );
  return res.status(200).json(
    new ApiResponse(true, result.message, 200, {
      users: result.users,
      pagination: result.pagination,
    }),
  );
});

const searchUserForMention = asyncHandler(async (req, res) => {
  const { query } = req.query;
  const currentUserId = req.userId;

  const result = await userService.searchUserForMention(query, currentUserId);

  return res
    .status(200)
    .json(new ApiResponse(true, result.message, 200, { users: result.users }));
});

const getUserPosts = asyncHandler(async (req, res) => {
  const { userId: targetUserId } = req.params;
  const page  = parseInt(req.query.page)  || 1;
  const limit = parseInt(req.query.limit) || 20;

  const result = await postService.getUserPosts(targetUserId, req.userId, page, limit);

  return res
    .status(200)
    .json(
      new ApiResponse(true, "User posts fetched successfully", 200, {
        posts: result.posts,
        pagination: result.pagination,
      }),
    );
});

// Get notification preferences
const getNotificationPreferences = asyncHandler(async (req, res) => {
  const userId = req.userId;

  const result = await userService.getNotificationPreferences(userId);

  return res
    .status(200)
    .json(
      new ApiResponse(
        true,
        "Notification preferences fetched successfully",
        200,
        result,
      ),
    );
});

// Update notification preferences
const updateNotificationPreferences = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const preferences = req.body;

  const result = await userService.updateNotificationPreferences(
    userId,
    preferences,
  );

  return res
    .status(200)
    .json(
      new ApiResponse(
        true,
        "Notification preferences updated successfully",
        200,
        result,
      ),
    );
});

export {
  signup,
  verifySignup,
  login,
  resendOtp,
  forgotPassword,
  verifyForgotPassword,
  resetPassword,
  updatePassword,
  updateProfile,
  deactiveUser,
  activateUser,
  verifyUserActivation,
  updatePrivacySettings,
  renewAccessToken,
  logout,
  getMyProfile,
  getUserProfile,
  searchUsers,
  searchUserForMention,
  getUserPosts,
  getNotificationPreferences,
  updateNotificationPreferences,
};
