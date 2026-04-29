import mongoose, { Schema } from "mongoose";

const postSchema = new Schema(
  {
    caption: {
      type: String,
      trim: true,
      maxlength: 2200,
    },
    media: [
      {
        url: {
          type: String,
        },
        media_public_id: {
          type: String,
        },
        type: {
          type: String,
          enum: ["image", "video"],
        },
      },
    ],
    visibility: {
      type: String,
      enum: ["public", "followers", "close_friends", "private"],
      default: "public",
    },
    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: [Number],
      name: String,
      address: String,
    },
    // Denormalization for performance
    likes_count: {
      type: Number,
      default: 0,
    },
    comments_count: {
      type: Number,
      default: 0,
    },
    shares_count: {
      type: Number,
      default: 0,
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
    
    // Draft support
    isDraft: {
      type: Boolean,
      default: false,
    },
    
    // Edit history
    is_edited: {
      type: Boolean,
      default: false,
    },
    last_edited_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Fast queries with soft delete
postSchema.index({ created_by: 1, createdAt: -1, isDeleted: 1 });
postSchema.index({ visibility: 1, isDeleted: 1, createdAt: -1 });
postSchema.index({ isDeleted: 1 });

export default mongoose.models.Post || mongoose.model("Post", postSchema);
