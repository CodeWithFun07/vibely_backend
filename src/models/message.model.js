import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema(
  {
    chat_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["text", "image", "video", "gif", "sticker"],
      default: "text",
    },

    content: {
      type: String,
      required: true,
    },

    media: [
      {
        url: {
          type: String,
        },
        url_public_id: {
          type: String,
        },
        type: {
          type: String,
          enum: ["image", "video"],
        },
      },
    ],

    // Message reactions
    reactions: [
      {
        user_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        reaction: {
          type: String,
          enum: ["like", "love", "haha", "wow", "sad", "angry"],
        },
      },
    ],

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // For threaded messages
    reply_to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Edit tracking
    is_edited: {
      type: Boolean,
      default: false,
    },
    edited_at: {
      type: Date,
      default: null,
    },

    deleted_for: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        deleted_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    deleted_for_everyone: {
      type: Boolean,
      default: false,
    },

    deleted_for_everyone_at: {
      type: Date,
      default: null,
    },

    is_pinned: {
      type: Boolean,
      default: false,
    },

    pinned_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    pinned_at: {
      type: Date,
      default: null,
    },

    seenBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        seen_at: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

// Indexes for fast message fetch and read status
messageSchema.index({ chat_id: 1, createdAt: -1, isDeleted: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ isDeleted: 1 });
messageSchema.index({ reply_to: 1 });

export default mongoose.models.Message ||
  mongoose.model("Message", messageSchema);
