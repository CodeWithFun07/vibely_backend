import mongoose, { Schema } from "mongoose";

const notificationSchema = new Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "like",
        "comment",
        "follow",
        "reply",
        "mention",
        "message",
        "post",
      ],
      required: true,
    },

    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },

    comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    chat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chat",
      default: null,
    },

    message: {
      type: String,
      default: "",
    },

    action_url: {
      type: String,
      default: null,
    },

    // Status tracking
    status: {
      type: String,
      enum: ["unread", "read", "archived", "deleted"],
      default: "unread",
    },

    isRead: {
      type: Boolean,
      default: false,
    },

    read_at: {
      type: Date,
      default: null,
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
  },
  { timestamps: true },
);

// Fast queries with status filtering
notificationSchema.index({ recipient: 1, status: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ sender: 1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ isDeleted: 1 });

export default mongoose.models.Notification ||
  mongoose.model("Notification", notificationSchema);
