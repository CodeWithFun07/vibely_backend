import mongoose, { Schema } from "mongoose";

const likeSchema = new Schema(
  {
    liked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    target_type: {
      type: String,
      enum: ["Post", "Comment"],
    },
    liked: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "target_type",
      index: true,
    },
    reaction_type: {
      type: String,
      enum: ["like", "love", "haha", "wow", "sad", "angry"],
      default: "like",
    },
  },
  { timestamps: true },
);

likeSchema.index({ liked_by: 1, liked: 1, target_type: 1 }, { unique: true });

const Like = mongoose.models.Likes || mongoose.model("Like", likeSchema);

export default Like;
