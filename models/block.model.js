import mongoose, { Schema } from "mongoose";

const blockSchema = new Schema(
  {
    blocked_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    blocked_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

blockSchema.index({ blocked_by: 1, blocked_user: 1 }, { unique: true });

blockSchema.pre("save", async function () {
  if (this.blocked_by.equals(this.blocked_user)) {
    throw new Error("You cannot block yourself");
  }
});

const Block = mongoose.models.Blocks || mongoose.model("Block", blockSchema);

export default Block;
