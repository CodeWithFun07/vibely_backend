import mongoose, { Schema } from "mongoose";

const reportSchema = new Schema(
  {
    reported_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reported_user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 500,
      required: true,
    },

    // Status lifecycle
    status: {
      type: String,
      enum: ["pending", "under_review", "resolved", "rejected"],
      default: "pending",
    },

    // Admin resolution
    resolution_action: {
      type: String,
      enum: ["none", "warning", "suspended", "banned", "content_removed"],
      default: "none",
    },

    admin_notes: {
      type: String,
      maxlength: 1000,
      default: null,
    },

    reviewed_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewed_at: {
      type: Date,
      default: null,
    },

    // Priority level
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // Related content
    reported_post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
  },
  { timestamps: true },
);

reportSchema.index({ reported_by: 1, reported_user: 1 }, { unique: true });
reportSchema.index({ status: 1, priority: 1, createdAt: -1 });
reportSchema.index({ reviewed_by: 1 });
reportSchema.index({ reported_user: 1, status: 1 });

reportSchema.pre("save", async function () {
  if (this.reported_by.equals(this.reported_user)) {
    throw new Error("You cannot report yourself");
  }
});

export default mongoose.models.Report ||
  mongoose.model("Report", reportSchema);
