import { uploadSingleFile, uploadMultipleFiles } from "../middlewares/multer.js";
import errorHandler from "../utils/errorHandler.js";
import isAuthenticated from "../middlewares/auth.middleware.js";
import {
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
} from "../controllers/user.controller.js";
import { Router } from "express";

const router = Router();

router.route("/signup").post(signup); // checked

router.route("/verify-signup").post(verifySignup); // checked

router.route("/login").post(login); //checked

router.route("/resend-otp").post(resendOtp); // checked

router.route("/forgot-password").post(forgotPassword); // checked

router.route("/verify-forgot-password").post(verifyForgotPassword); // checked

router.route("/reset-password").post(resetPassword); // checked

router.route("/refresh-token").post(renewAccessToken); // checked

// protected routes
router.route("/update-password").post(isAuthenticated, updatePassword); // checked

router.route("/my-profile").get(isAuthenticated, getMyProfile);

router
  .route("/update-profile")
  .put(
    isAuthenticated,
    uploadMultipleFiles([
      { name: "profile_picture", maxCount: 1 },
      { name: "cover_picture",   maxCount: 1 },
    ]),
    updateProfile
  );

router.route("/deactive-user").post(isAuthenticated, deactiveUser); // checked

router.route("/activate-user").post(isAuthenticated, activateUser); // checked

router
  .route("/verify-user-activation")
  .post(isAuthenticated, verifyUserActivation); // checked

router
  .route("/update-privacy-settings")
  .post(isAuthenticated, updatePrivacySettings); // checked

router.route("/logout").post(isAuthenticated, logout); // checked

router.route("/search-user").get(isAuthenticated, searchUsers);
router.route("/search-user-for-mention").get(isAuthenticated, searchUserForMention);

router.route("/user-profile/:identifier").get(isAuthenticated, getUserProfile);

// Get any user's posts for profile page
router.route("/posts/:userId").get(isAuthenticated, getUserPosts);

// Notification preferences routes
router
  .route("/notification-preferences")
  .get(isAuthenticated, getNotificationPreferences);

router
  .route("/notification-preferences")
  .put(isAuthenticated, updateNotificationPreferences);

// error handler middleware
router.use(errorHandler);

export default router;
