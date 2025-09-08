const mongoose = require("mongoose");

const logSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: [
        "user_activity",
        "security_event",
        "file_activity",
        "room_activity",
        "system",
      ],
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      sparse: true,
    },
    anonymousId: String,
    ip: String,
    userAgent: String,
    action: String,
    details: mongoose.Schema.Types.Mixed,
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low",
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster querying
logSchema.index({ type: 1, createdAt: -1 });
logSchema.index({ userId: 1, createdAt: -1 });
logSchema.index({ ip: 1, createdAt: -1 });

module.exports = mongoose.model("Log", logSchema);
