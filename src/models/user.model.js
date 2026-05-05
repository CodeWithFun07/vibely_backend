import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 30,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    phone_number: {
      type: String,
    },
    password: {
      type: String,
    },
    google_id: {
      type: String,
    },
    fcm_token: {
      type: String,
    },

    // Account status
    is_active: {
      type: Boolean,
      default: false,
    },
    is_verified: {
      type: Boolean,
      default: false,
    },
    email_verified_at: {
      type: Date,
      default: null,
    },

    // Online status
    is_online: {
      type: Boolean,
      default: false,
    },
    last_seen: {
      type: Date,
      default: null,
    },

    // Account security
    is_banned: {
      type: Boolean,
      default: false,
    },
    ban_reason: {
      type: String,
      default: null,
    },
    banned_at: {
      type: Date,
      default: null,
    },
    ban_expires_at: {
      type: Date,
      default: null,
    },

    // Privacy settings
    is_private: {
      type: Boolean,
      default: false,
    },
    allow_follow: {
      type: Boolean,
      default: true,
    },
    message_privacy: {
      type: String,
      enum: ["everyone", "followers", "no_one"],
      default: "everyone",
    },
    who_can_see_followers: {
      type: String,
      enum: ["everyone", "followers", "no_one"],
      default: "everyone",
    },
    who_can_see_following: {
      type: String,
      enum: ["everyone", "followers", "no_one"],
      default: "everyone",
    },
    is_like_notifications_enabled: {
      type: Boolean,
      default: true,
    },
    is_comment_notifications_enabled: {
      type: Boolean,
      default: true,
    },
    is_follow_notifications_enabled: {
      type: Boolean,
      default: true,
    },
    is_post_notifications_enabled: {
      type: Boolean,
      default: true,
    },
    is_message_notifications_enabled: {
      type: Boolean,
      default: true,
    },
    is_message_notifications_enabled: {
      type: Boolean,
      default: true,
    },

    // Denormalization for performance
    followers_count: {
      type: Number,
      default: 0,
    },
    following_count: {
      type: Number,
      default: 0,
    },
    posts_count: {
      type: Number,
      default: 0,
    },

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    refresh_token: {
      type: String,
    },

    refresh_token_created_at: {
      type: Date,
      default: null,
    },

    profile: {
      profile_picture: {
        type: String,
      },
      profile_picture_public_id: {
        type: String,
      },
      cover_picture: {
        type: String,
      },
      cover_picture_public_id: {
        type: String,
      },
      full_name: {
        type: String,
      },
      bio: {
        type: String,
        maxlength: 150,
      },
      address: {
        type: String,
      },
      birthday: {
        type: Date,
      },
      gender: {
        type: String,
        enum: ["male", "female", "other"],
      },
      website: {
        type: String,
      },
    },

    // Notification preferences
    notification_preferences: {
      likes: {
        type: Boolean,
        default: true,
      },
      comments: {
        type: Boolean,
        default: true,
      },
      follows: {
        type: Boolean,
        default: true,
      },
      mentions: {
        type: Boolean,
        default: true,
      },
      posts: {
        type: Boolean,
        default: true,
      },
      messages: {
        type: Boolean,
        default: true,
      },
    },

    // Soft delete support
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deleted_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Unique indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ phone_number: 1 }, { sparse: true, unique: true });
userSchema.index({ google_id: 1 }, { sparse: true });

// Search and filter indexes
userSchema.index({ username: "text", "profile.full_name": "text" });
userSchema.index({ is_banned: 1, isDeleted: 1 });
userSchema.index({ is_verified: 1, is_active: 1 });
userSchema.index({ createdAt: -1 });

export default mongoose.models.Users || mongoose.model("User", userSchema);
