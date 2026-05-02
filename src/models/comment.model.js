import mongoose, { Schema } from "mongoose";

const commentSchema = new Schema(
  {
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    content: {
      type: String,
      maxlength: 300,
      required: true,
    },
    post_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    parent_comment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },

    // Edit tracking
    isEdited: {
      type: Boolean,
      default: false,
    },
    edited_at: {
      type: Date,
      default: null,
    },

    // Denormalization for performance
    likes_count: {
      type: Number,
      default: 0,
    },
    replies_count: {
      type: Number,
      default: 0,
    },

    mentions: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Soft delete
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deleted_at: {
      type: Date,
      default: null,
    },

    // Pinned comments
    is_pinned: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

// Indexes for better performance
commentSchema.index({ post_id: 1, createdAt: -1, isDeleted: 1 });
commentSchema.index({ parent_comment: 1, createdAt: 1 });
commentSchema.index({ created_by: 1 });
commentSchema.index({ isDeleted: 1 });
commentSchema.index({ is_pinned: 1, post_id: 1 });

export default mongoose.models.Comments || mongoose.model("Comment", commentSchema);
