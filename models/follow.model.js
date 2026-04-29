import mongoose, { Schema } from "mongoose";

const followSchema = new Schema(
  {
    followed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    following: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

followSchema.index({ followed_by: 1, following: 1 }, { unique: true });

const Follow = mongoose.models.Follow || mongoose.model("Follow", followSchema);

export default Follow;
