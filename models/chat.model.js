import mongoose, { Schema } from "mongoose";

const chatSchema = new Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
      },
    ],

    isGroup: {
      type: Boolean,
      default: false,
    },

    groupName: {
      type: String,
      default: null,
      maxlength: 100,
    },

    groupImage: {
      type: String,
      default: null,
    },

    groupImage_public_id: {
      type: String,
      default: null,
    },

    groupDescription: {
      type: String,
      default: null,
      maxlength: 500,
    },

    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Member roles for groups
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        role: {
          type: String,
          enum: ["admin", "moderator", "member"],
          default: "member",
        },
        joined_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Denormalization for performance
    unread_count: {
      type: Number,
      default: 0,
    },

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },

    // Archive support
    is_archived: {
      type: Boolean,
      default: false,
    },

    // Mute notifications
    muted_by: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
  },
  { timestamps: true },
);

// Fast chat lookup and filtering
chatSchema.index({ participants: 1, isDeleted: 1 });
chatSchema.index({ isDeleted: 1, is_archived: 1 });
chatSchema.index({ lastMessage: 1 });
chatSchema.index({ createdAt: -1 });

export default mongoose.models.Chat || mongoose.model("Chat", chatSchema);
