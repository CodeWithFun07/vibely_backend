import mongoose, { Schema } from "mongoose";

const bookmarkSchema = new Schema(
  {
    bookmark_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

bookmarkSchema.index({ bookmark_by: 1, post_id: 1 }, { unique: true });

// fast lookup
bookmarkSchema.index({ bookmark_by: 1 });
bookmarkSchema.index({ post_id: 1 });

const Bookmark =
  mongoose.models.Bookmark || mongoose.model("Bookmark", bookmarkSchema);

export default Bookmark;
