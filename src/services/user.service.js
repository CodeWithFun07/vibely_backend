import client from "../config/redis.config.js";
import {
  cacheGetJson,
  cacheSetJson,
  myProfileCacheKey,
  userProfileCacheKey,
  invalidateUserProfileCaches,
  TTL_PROFILE_SECONDS,
} from "../utils/cacheAside.js";
import {
  accountVerifiedTemplate,
  resendOtpEmailTemplate,
  verifySignupEmailTemplate,
  resetPasswordOtpTemplate,
  passwordResetConfirmationTemplate,
  accountDeactivatedTemplate,
  accountReactivationOtpTemplate,
  accountReactivatedTemplate,
} from "../email/email_templates.js";
import User from "../models/user.model.js";
import Post from "../models/post.model.js";
import Bookmark from "../models/bookmark.model.js";
import Follow from "../models/follow.model.js";
import Block from "../models/block.model.js";
import ApiError from "../utils/apiError.js";
import generateRandomOtp from "../utils/generateOtp.js";
import sendMail from "../utils/sendMail.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateAccessToken, generateRefreshToken } from "../utils/tokens.js";
import getDataUri from "../config/datauri.config.js";
import cloudinary from "../config/cloudinary.config.js";

class UserService {
  /** Signup a new user
   * full_name
   * username
   * email
   * phone_number
   * password
   */
  async signup(userData) {
    const { email, username, phone_number, password } = userData;

    if (!email || !username || !password || !phone_number) {
      throw new ApiError(400, "All fields are required");
    }

    if (!email || !username || !password) {
      throw new ApiError(400, "Email, username and password are required");
    }

    if (password.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters long");
    }

    // check user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }, { phone_number }],
    });

    if (existingUser) {
      throw new ApiError(
        400,
        "account exists with the provided email, username or phone number",
      );
    }

    // generate otp for user
    const otp = generateRandomOtp(6);

    await client.set(`otp:${email}`, otp, {
      EX: 120,
    }); // otp expires in 2 minutes

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      email,
      username,
      phone_number,
      password: hashedPassword,
    });

    await user.save();

    try {
      await sendMail({
        to: email,
        subject: "verify your email",
        html: verifySignupEmailTemplate(username, otp, email),
      });
    } catch {
      await User.deleteOne({ _id: user._id });
      await client.del(`otp:${email}`);
      throw new ApiError(
        500,
        "We could not send the verification email. Please try again later.",
      );
    }

    return {
      message: "Signup successful. Please verify your email.",
      user: {
        email,
      },
    };
  }

  /** verify signup
   * email
   * otp
   */
  async verifySignup({ email, otp }) {
    if (!email) {
      throw new ApiError(400, "Email is required");
    }

    if (!otp) {
      throw new ApiError(400, "OTP is required");
    }

    const storedOtp = await client.get(`otp:${email}`);

    if (!storedOtp) {
      throw new ApiError(400, "OTP has expired. Please request a new one.");
    }

    if (storedOtp !== otp) {
      throw new ApiError(400, "Invalid OTP. Please try again.");
    }

    await client.del(`otp:${email}`);

    const user = await User.findOne({ email });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const accessToken = await generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    user.is_verified = true;
    user.is_active = true;
    user.refresh_token = refreshToken;
    user.refresh_token_created_at = new Date();
    await user.save();

    await invalidateUserProfileCaches(user._id.toString(), user.username);

    try {
      await sendMail({
        to: email,
        subject: "Email verified successfully",
        html: accountVerifiedTemplate({
          username: user.username,
          fullName: user.profile.full_name,
          email: user.email,
        }),
      });
    } catch (e) {
      console.error("Verify signup welcome email failed:", e?.message || e);
    }

    return {
      message: "Email verified successfully",
      accessToken,
      refreshToken,
    };
  }

  /** login user
   * email or phone_number or username
   * password
   */
  async login({ identifier, password }) {
    if (!identifier || !password) {
      throw new ApiError(
        400,
        "Email/username/phone number and password are required",
      );
    }

    const user = await User.findOne({
      $or: [
        { email: identifier },
        { username: identifier },
        { phone_number: identifier },
      ],
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      throw new ApiError(400, "Invalid credentials");
    }

    if (!user.is_verified) {
      throw new ApiError(
        403,
        "Your account is not verified. Please verify your account to login.",
      );
    }

    const accessToken = await generateAccessToken(user._id);
    const refreshToken = await generateRefreshToken(user._id);

    user.refresh_token = refreshToken;
    user.refresh_token_created_at = new Date();
    user.is_online = true;
    user.last_seen = null;

    await user.save();

    return {
      accessToken,
      refreshToken,
    };
  }

  /** resend otp
   * email
   */
  async resendOtp({ email }) {
    if (!email) {
      throw new ApiError(404, "email is required");
    }

    const user = await User.findOne({
      email,
    });

    if (!user) {
      throw new ApiError(404, "user not found");
    }

    const existingSendCode = await client.get(`otp:${email}`);

    console.log("check existing code", existingSendCode);

    if (existingSendCode) {
      throw new ApiError(400, "code already send to your email");
    }

    const otp = await generateRandomOtp(6);

    await client.set(`otp:${email}`, otp, {
      EX: 120,
    });

    try {
      await sendMail({
        to: email,
        subject: "Resend Otp Code",
        html: resendOtpEmailTemplate({
          username: user.username,
          email: user.email,
          otp,
        }),
      });
    } catch {
      await client.del(`otp:${email}`);
      throw new ApiError(
        500,
        "We could not send the OTP email. Please try again later.",
      );
    }

    return {
      message: "Otp Send To Your Email",
    };
  }

  /** forgot password
   * identifier
   */
  async forgotPassword(identifier) {
    if (!identifier) {
      throw new ApiError(404, "email, username or phone number is required");
    }

    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
        { phone_number: identifier },
      ],
    });

    if (!user) {
      throw new ApiError(404, "user not found");
    }

    const otp = generateRandomOtp(6);
    await client.set(`forgot-password:${user.email}`, otp, {
      EX: 120,
    }); // otp expires in 2 minutes

    try {
      await sendMail({
        to: user.email,
        subject: "Reset Your Password",
        html: resetPasswordOtpTemplate({
          username: user.username,
          email: user.email,
          otp,
        }),
      });
    } catch {
      await client.del(`forgot-password:${user.email}`);
      throw new ApiError(
        500,
        "We could not send the password reset email. Please try again later.",
      );
    }

    return {
      message: "Password reset OTP sent to your email",
      email: user.email,
    };
  }

  /** verify forgot password
   * email
   * otp
   */
  async verifyForgotPassword({ email, otp }) {
    if (!email || !otp) {
      throw new ApiError(400, "Email and OTP are required");
    }

    const storedOtp = await client.get(`forgot-password:${email}`);

    if (!storedOtp) {
      throw new ApiError(400, "OTP has expired. Please request a new one.");
    }

    if (storedOtp !== otp) {
      throw new ApiError(400, "Invalid OTP. Please try again.");
    }

    const user = await User.findOne({ email });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Generate a temporary token for password reset
    const resetToken = Math.random().toString(36).substring(2, 15);
    await client.set(`reset-token:${email}`, resetToken, {
      EX: 900,
    }); // token expires in 15 minutes

    await client.del(`forgot-password:${email}`);

    return {
      message: "OTP verified successfully",
      resetToken,
    };
  }

  /** reset password
   * email
   * new_password
   */
  async resetPassword({ email, new_password }) {
    if (!email || !new_password) {
      throw new ApiError(400, "Email and new password are required");
    }

    if (new_password.length < 6) {
      throw new ApiError(400, "Password must be at least 6 characters long");
    }

    const user = await User.findOne({ email });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    user.password = hashedPassword;
    await user.save();

    await invalidateUserProfileCaches(user._id.toString(), user.username);

    await client.del(`reset-token:${email}`);

    try {
      await sendMail({
        to: email,
        subject: "Password Reset Successful",
        html: passwordResetConfirmationTemplate({
          username: user.username,
          email: user.email,
        }),
      });
    } catch (e) {
      console.error(
        "Password reset confirmation email failed:",
        e?.message || e,
      );
    }

    return {
      message: "Password has been reset successfully",
    };
  }

  /** update password
   * userId
   * old_password
   * new_password
   */
  async updatePassword({
    userId,
    old_password,
    new_password,
    confirm_password,
  }) {
    if (!userId || !old_password || !new_password) {
      throw new ApiError(
        400,
        "User ID, old password and new password are required",
      );
    }

    if (new_password.length < 6) {
      throw new ApiError(
        400,
        "New password must be at least 6 characters long",
      );
    }

    if (new_password !== confirm_password) {
      throw new ApiError(400, "Password do not match");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isMatch = await bcrypt.compare(old_password, user.password);

    if (!isMatch) {
      throw new ApiError(400, "Old password is incorrect");
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);
    user.password = hashedPassword;
    await user.save();

    await invalidateUserProfileCaches(user._id.toString(), user.username);

    return {
      message: "Password updated successfully",
    };
  }

  /** update profile */
  async updateProfile({
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
    is_private,
  }) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Check if username is already taken by another user
    if (username && username !== user.username) {
      const existingUser = await User.findOne({ username });
      if (existingUser) {
        throw new ApiError(400, "Username is already taken");
      }
      user.username = username;
    }

    // Check if phone number is already taken by another user
    if (phone_number && phone_number !== user.phone_number) {
      const existingUser = await User.findOne({ phone_number });
      if (existingUser) {
        throw new ApiError(400, "Phone number is already registered");
      }
      user.phone_number = phone_number;
    }

    // Update profile fields
    if (full_name !== undefined) user.profile.full_name = full_name;
    if (bio !== undefined) user.profile.bio = bio;
    if (address !== undefined) user.profile.address = address;
    if (website !== undefined) user.profile.website = website;
    if (gender !== undefined) user.profile.gender = gender;

    // Update privacy setting
    if (is_private !== undefined) user.is_private = is_private;

    // Upload profile picture
    if (profile_picture) {
      const profile_pic_data_uri = await getDataUri(profile_picture);
      const profile_pic_url = await cloudinary.uploader.upload(
        profile_pic_data_uri.content,
        { folder: "/profile_picture" },
      );

      if (user.profile.profile_picture_public_id) {
        try {
          await cloudinary.uploader.destroy(
            user.profile.profile_picture_public_id,
          );
        } catch (error) {
          console.log("profile picture delete failed", error);
        }
      }

      user.profile.profile_picture = profile_pic_url.secure_url;
      user.profile.profile_picture_public_id = profile_pic_url.public_id;
    }

    // Upload cover picture
    if (cover_picture) {
      const cover_pic_data_uri = await getDataUri(cover_picture);
      const cover_pic_url = await cloudinary.uploader.upload(
        cover_pic_data_uri.content,
        { folder: "/cover_picture" },
      );

      if (user.profile.cover_picture_public_id) {
        try {
          await cloudinary.uploader.destroy(
            user.profile.cover_picture_public_id,
          );
        } catch (error) {
          console.log("cover picture delete failed", error);
        }
      }

      user.profile.cover_picture = cover_pic_url.secure_url;
      user.profile.cover_picture_public_id = cover_pic_url.public_id;
    }

    await user.save();

    await invalidateUserProfileCaches(user._id.toString(), user.username);

    return {
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        phone_number: user.phone_number,
        is_private: user.is_private,
        profile: user.profile,
        followers_count: user.followers_count,
        following_count: user.following_count,
        posts_count: user.posts_count,
      },
    };
  }

  /** deactive user
   * userId
   */
  async deactiveUser({ userId }) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    user.is_active = false;
    user.is_verified = false;
    await user.save();

    await invalidateUserProfileCaches(user._id.toString(), user.username);

    try {
      await sendMail({
        to: user.email,
        subject: "Account Deactivated",
        html: accountDeactivatedTemplate({
          username: user.username,
          email: user.email,
        }),
      });
    } catch (e) {
      console.error("Account deactivated email failed:", e?.message || e);
    }

    return {
      message: "Account has been deactivated",
    };
  }

  /**
   * activate user
   * identifier (email, username, or phone_number)
   */
  async activateUser(userId) {
    if (!userId) {
      throw new ApiError(400, "userId is required");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const otp = generateRandomOtp(6);
    await client.set(`reactivate:${user.email}`, otp, {
      EX: 120,
    }); // otp expires in 2 minutes

    try {
      await sendMail({
        to: user.email,
        subject: "Reactivate Your Account",
        html: accountReactivationOtpTemplate({
          username: user.username,
          email: user.email,
          otp,
        }),
      });
    } catch {
      await client.del(`reactivate:${user.email}`);
      throw new ApiError(
        500,
        "We could not send the reactivation email. Please try again later.",
      );
    }

    return {
      message: "Reactivation OTP sent to your email",
      email: user.email,
    };
  }

  /** verify user activation */
  async verifyUserActivation({ userId, otp }) {
    if (!userId || !otp) {
      throw new ApiError(400, "userId and OTP are required");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "user not found");
    }

    const storedOtp = await client.get(`reactivate:${user.email}`);

    if (!storedOtp) {
      throw new ApiError(400, "OTP has expired. Please request a new one.");
    }

    if (storedOtp !== otp) {
      throw new ApiError(400, "Invalid OTP. Please try again.");
    }

    user.is_active = true;
    await user.save();

    await invalidateUserProfileCaches(user._id.toString(), user.username);

    await client.del(`reactivate:${user.email}`);

    try {
      await sendMail({
        to: user.email,
        subject: "Account Reactivated Successfully",
        html: accountReactivatedTemplate({
          username: user.username,
          email: user.email,
        }),
      });
    } catch (e) {
      console.error("Account reactivated email failed:", e?.message || e);
    }

    return {
      message: "Account has been reactivated successfully",
    };
  }

  /** update allow_follow,is_private,message_privacy status
   * userId
   * allow_follow
   * is_private
   * message_privacy
   */
  async updatePrivacySettings({
    userId,
    allow_follow,
    is_private,
    message_privacy,
    who_can_see_followers,
    who_can_see_following,
  }) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    if (typeof allow_follow !== "undefined") {
      user.allow_follow = allow_follow;
    }

    if (typeof is_private !== "undefined") {
      user.is_private = is_private;
    }

    if (
      message_privacy &&
      ["everyone", "followers", "no_one"].includes(message_privacy)
    ) {
      user.message_privacy = message_privacy;
    }

    if (
      who_can_see_followers &&
      ["everyone", "followers", "no_one"].includes(who_can_see_followers)
    ) {
      user.who_can_see_followers = who_can_see_followers;
    }

    if (
      who_can_see_following &&
      ["everyone", "followers", "no_one"].includes(who_can_see_following)
    ) {
      user.who_can_see_following = who_can_see_following;
    }

    await user.save();

    await invalidateUserProfileCaches(user._id.toString(), user.username);

    return {
      message: "Privacy settings updated successfully",
      settings: {
        allow_follow: user.allow_follow,
        is_private: user.is_private,
        message_privacy: user.message_privacy,
        who_can_see_followers: user.who_can_see_followers,
        who_can_see_following: user.who_can_see_following,
      },
    };
  }

  /** refresh access token
   * refreshToken
   */
  async refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new ApiError(401, "Refresh token is required");
    }

    try {
      const decoded = jwt.verify(
        refreshToken,
        process.env.REFRESH_TOKEN_SECRET,
      );

      const user = await User.findById(decoded.userId);

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      // Optionally: verify that the refresh token matches the one stored in the database
      if (user.refresh_token !== refreshToken) {
        throw new ApiError(401, "Invalid refresh token");
      }

      const newAccessToken = await generateAccessToken(user._id);

      return {
        message: "Access token refreshed successfully",
        accessToken: newAccessToken,
      };
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new ApiError(401, "Refresh token has expired");
      }
      if (error.name === "JsonWebTokenError") {
        throw new ApiError(401, "Invalid refresh token");
      }
      throw error;
    }
  }

  /**
   *
   * @param {*} userId
   */

  async logout(userId) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Only update online status and last seen, NOT is_active
    user.refresh_token = "";
    user.is_online = false;
    user.last_seen = new Date();
    await user.save();

    await invalidateUserProfileCaches(user._id.toString(), user.username);

    return {
      message: "Logout successful",
    };
  }

  /** get my profile
   * userId
   */
  async getMyProfile(userId) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    const profileCacheKey = myProfileCacheKey(userId);
    const cachedProfile = await cacheGetJson(profileCacheKey);
    if (cachedProfile) {
      return cachedProfile;
    }

    const user = await User.findById(userId).select("-password -refresh_token");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Get user posts count
    const postsCount = await Post.countDocuments({
      created_by: userId,
      isDeleted: false,
    });

    // Get user recent posts (last 5)
    const recentPosts = await Post.find({
      created_by: userId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("caption media visibility likes_count comments_count createdAt");

    // Get bookmarks count
    const bookmarksCount = await Bookmark.countDocuments({
      bookmark_by: userId,
      isActive: true,
    });

    // Get followers count
    const followersCount = await Follow.countDocuments({
      following: userId,
    });

    // Get following count
    const followingCount = await Follow.countDocuments({
      followed_by: userId,
    });

    // Get blocked users to handle mentions visibility in frontend
    const blockedRelations = await Block.find({
      blocked_by: userId,
      isActive: true,
    }).populate("blocked_user", "username");

    const blockedUsernames = blockedRelations
      .map((rel) => rel.blocked_user?.username)
      .filter(Boolean);

    const profilePayload = {
      message: "Profile retrieved successfully",
      user: {
        ...user.toObject(),
        blocked_usernames: blockedUsernames,
        stats: {
          postsCount,
          bookmarksCount,
          followersCount,
          followingCount,
        },
        recentPosts,
      },
    };

    await cacheSetJson(profileCacheKey, profilePayload, TTL_PROFILE_SECONDS);

    return profilePayload;
  }

  /** get user profile
   * identifier (userId or username)
   */
  async getUserProfile(identifier, currentUserId = null) {
    if (!identifier) {
      throw new ApiError(400, "User ID or username is required");
    }

    const publicProfileCacheKey = userProfileCacheKey(
      identifier,
      currentUserId,
    );
    const cachedPublicProfile = await cacheGetJson(publicProfileCacheKey);
    if (cachedPublicProfile) {
      return cachedPublicProfile;
    }

    let user;

    // Check if identifier is a valid MongoDB ObjectId or username
    if (identifier.length === 24) {
      // Likely a MongoDB ObjectId
      user = await User.findById(identifier).select("-password -refresh_token");
    } else {
      // Search by username
      user = await User.findOne({ username: identifier }).select(
        "-password -refresh_token",
      );
    }

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    const isBlocked = await Block.findOne({
      $or: [
        {
          blocked_by: currentUserId,
          blocked_user: user._id,
        },
        {
          blocked_by: user._id,
          blocked_user: currentUserId,
        },
      ],
      isActive: true,
    });

    if (isBlocked) {
      throw new ApiError(400, "You can't view this profile");
    }

    // Get user posts count
    const isOwnProfile =
      currentUserId && currentUserId.toString() === user._id.toString();
    const postsCount = await Post.countDocuments({
      created_by: user._id,
      isDeleted: false,
      ...(isOwnProfile ? {} : { visibility: { $in: ["public", "followers"] } }),
    });

    // Get user public/followers posts (last 5)
    const recentPosts = await Post.find({
      created_by: user._id,
      isDeleted: false,
      visibility: { $in: ["public", "followers"] },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .select("caption media visibility likes_count comments_count createdAt");

    // Get followers count
    const followersCount = await Follow.countDocuments({
      following: user._id,
    });

    // Get following count
    const followingCount = await Follow.countDocuments({
      followed_by: user._id,
    });

    // Check if current user is following this user
    let isFollowing = false;
    if (currentUserId && currentUserId !== user._id.toString()) {
      const follow = await Follow.findOne({
        followed_by: currentUserId,
        following: user._id,
      });
      isFollowing = !!follow;
    }

    const publicProfilePayload = {
      message: "User profile retrieved successfully",
      user: {
        ...user.toObject(),
        stats: {
          postsCount,
          followersCount,
          followingCount,
        },
        recentPosts,
        isFollowing,
      },
    };

    await cacheSetJson(
      publicProfileCacheKey,
      publicProfilePayload,
      TTL_PROFILE_SECONDS,
    );

    return publicProfilePayload;
  }

  /** search users (Instagram-like)
   * searchQuery
   * currentUserId (to exclude blocked users)
   * page
   * limit
   */
  async searchUsers(searchQuery, currentUserId, page = 1, limit = 10) {
    if (!searchQuery || searchQuery.trim() === "") {
      throw new ApiError(400, "Search query is required");
    }

    if (!currentUserId) {
      throw new ApiError(400, "Current user ID is required");
    }

    const skip = (page - 1) * limit;

    // Get blocked user IDs (users who blocked current user or current user blocked)
    const blockedRelations = await Block.find({
      $or: [
        { blocked_by: currentUserId }, // Current user blocked someone
        { blocked_user: currentUserId }, // Someone blocked current user
      ],
    }).select("blocked_by blocked_user");

    // Extract blocked user IDs
    const blockedUserIds = blockedRelations
      .flatMap((b) => [b.blocked_by, b.blocked_user])
      .filter((id) => id.toString() !== currentUserId.toString());

    const query = {
      $or: [
        { username: { $regex: searchQuery, $options: "i" } },
        { email: { $regex: searchQuery, $options: "i" } },
        { "profile.full_name": { $regex: searchQuery, $options: "i" } },
      ],
      // Don't exclude current user - users should be able to find themselves
      is_banned: false, // Exclude banned users
      isDeleted: false, // Exclude soft-deleted users
    };

    // Exclude blocked users if any
    if (blockedUserIds.length > 0) {
      query._id = { ...query._id, $nin: blockedUserIds };
    }

    // Search users
    const users = await User.find(query, "-password -refresh_token")
      .skip(skip)
      .limit(limit)
      .lean();

    // Check if current user is following each found user
    const userIds = users.map((u) => u._id);
    const followingRecords = await Follow.find({
      followed_by: currentUserId,
      following: { $in: userIds },
    }).select("following");

    const followingSet = new Set(
      followingRecords.map((r) => r.following.toString()),
    );

    // Get total count for pagination
    const totalUsers = await User.countDocuments(query);

    const totalPages = Math.ceil(totalUsers / limit);

    // Add indicators to each user
    const usersWithFlags = users.map((user) => ({
      ...user,
      isPrivate: user.is_private || false,
      isVerified: user.is_verified || false,
      isFollowing: followingSet.has(user._id.toString()),
    }));

    return {
      users: usersWithFlags,
      pagination: {
        totalUsers,
        totalPages,
        currentPage: page,
        limit,
      },
      message: "Users fetched successfully",
    };
  }

  /**
   * Search users for mentions (followers and following)
   * @param {string} query Search query
   * @param {string} currentUserId Current user ID
   */
  async searchUserForMention(query, currentUserId) {
    if (!currentUserId) {
      throw new ApiError(401, "Authentication required");
    }

    // 1. Find people current user follows
    const following = await Follow.find({ followed_by: currentUserId }).select(
      "following",
    );
    const followingIds = following.map((f) => f.following);

    // 2. Find people who follow current user
    const followers = await Follow.find({ following: currentUserId }).select(
      "followed_by",
    );
    const followerIds = followers.map((f) => f.followed_by);

    // Combine unique IDs
    const relatedUserIds = [...new Set([...followingIds, ...followerIds])];

    // 3. Search within these users
    const searchQuery = {
      _id: { $in: relatedUserIds, $ne: currentUserId }, // Exclude self
      isDeleted: false,
    };

    if (query) {
      searchQuery.$or = [
        { username: { $regex: query, $options: "i" } },
        { "profile.full_name": { $regex: query, $options: "i" } },
      ];
    }

    const users = await User.find(searchQuery)
      .select(
        "username profile.full_name profile.profile_picture is_online is_verified",
      )
      .limit(10);

    return {
      users,
      message: "Mention suggestions fetched successfully",
    };
  }

  /** get user bookmarks
   * userId
   * page
   * limit
   */
  async getUserBookmarks(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    const skip = (page - 1) * limit;

    // Get bookmarked posts
    const bookmarks = await Bookmark.find({
      bookmark_by: userId,
      isActive: true,
    })
      .populate({
        path: "post_id",
        populate: [{ path: "created_by", select: "username profile" }],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Map to return just the post objects (flattening the bookmark record)
    const bookmarkedPosts = bookmarks
      .filter((b) => b.post_id && !b.post_id.isDeleted)
      .map((b) => ({
        ...b.post_id,
        is_bookmarked: true,
      }));

    // Get total bookmarks count
    const totalBookmarks = await Bookmark.countDocuments({
      bookmark_by: userId,
      isActive: true,
    });

    const totalPages = Math.ceil(totalBookmarks / limit);

    return {
      message: "Bookmarks retrieved successfully",
      bookmarks: bookmarkedPosts,
      pagination: {
        currentPage: page,
        totalPages,
        totalBookmarks,
        limit,
      },
    };
  }

  /** get user followers
   * userId
   * page
   * limit
   */
  async getUserFollowers(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    const skip = (page - 1) * limit;

    const followers = await Follow.find({
      following: userId,
    })
      .populate({
        path: "followed_by",
        select: "username profile email",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalFollowers = await Follow.countDocuments({
      following: userId,
    });

    const totalPages = Math.ceil(totalFollowers / limit);

    return {
      message: "Followers retrieved successfully",
      followers: followers.map((f) => f.followed_by),
      pagination: {
        currentPage: page,
        totalPages,
        totalFollowers,
        limit,
      },
    };
  }

  /** get user following
   * userId
   * page
   * limit
   */
  async getUserFollowing(userId, page = 1, limit = 10) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    const skip = (page - 1) * limit;

    const following = await Follow.find({
      followed_by: userId,
    })
      .populate({
        path: "following",
        select: "username profile email",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalFollowing = await Follow.countDocuments({
      followed_by: userId,
    });

    const totalPages = Math.ceil(totalFollowing / limit);

    return {
      message: "Following list retrieved successfully",
      following: following.map((f) => f.following),
      pagination: {
        currentPage: page,
        totalPages,
        totalFollowing,
        limit,
      },
    };
  }

  /**
   * Get notification preferences for a user
   */
  async getNotificationPreferences(userId) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    try {
      const user = await User.findById(userId).select(
        "notification_preferences",
      );
      if (!user) {
        throw new ApiError(404, "User not found");
      }

      return {
        notification_preferences: user.notification_preferences || {
          likes: true,
          comments: true,
          follows: true,
          mentions: true,
          posts: true,
          messages: true,
        },
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to fetch notification preferences");
    }
  }

  /**
   * Update notification preferences for a user
   */
  async updateNotificationPreferences(userId, preferences) {
    if (!userId) {
      throw new ApiError(400, "User ID is required");
    }

    if (!preferences || typeof preferences !== "object") {
      throw new ApiError(400, "Preferences must be an object");
    }

    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          notification_preferences: {
            likes: preferences.likes !== undefined ? preferences.likes : true,
            comments:
              preferences.comments !== undefined ? preferences.comments : true,
            follows:
              preferences.follows !== undefined ? preferences.follows : true,
            mentions:
              preferences.mentions !== undefined ? preferences.mentions : true,
            posts: preferences.posts !== undefined ? preferences.posts : true,
            messages:
              preferences.messages !== undefined ? preferences.messages : true,
          },
        },
        { returnDocument: 'after' },
      ).select("notification_preferences");

      if (!user) {
        throw new ApiError(404, "User not found");
      }

      return {
        message: "Notification preferences updated successfully",
        notification_preferences: user.notification_preferences,
      };
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(500, "Failed to update notification preferences");
    }
  }
}

export const userService = new UserService();
