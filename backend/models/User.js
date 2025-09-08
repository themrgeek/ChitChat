const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator");

const userSchema = new mongoose.Schema(
  {
    // Identity verification fields
    nationalId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: function (v) {
          // Basic validation - adjust based on your country's ID format
          return /^[A-Z0-9]{8,20}$/.test(v);
        },
        message: "Invalid national ID format",
      },
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Invalid email address"],
    },

    // Anonymous chat credentials
    anonymousId: {
      type: String,
      unique: true,
      sparse: true,
    },
    publicKey: String,
    avatar: String,

    // Security fields
    ipHistory: [
      {
        ip: String,
        timestamp: { type: Date, default: Date.now },
        userAgent: String,
      },
    ],
    isVerified: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    blockReason: String,

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastLogin: Date,
  },
  {
    timestamps: true,
  }
);

// Generate anonymous credentials
userSchema.methods.generateAnonymousCredentials = function () {
  const { v4: uuidv4 } = require("uuid");
  const crypto = require("crypto");

  this.anonymousId = `anon-${uuidv4().split("-")[0]}`;
  const privateKey = crypto.randomBytes(32).toString("hex");
  this.publicKey = crypto.createHash("sha256").update(privateKey).digest("hex");

  return { anonymousId: this.anonymousId, privateKey };
};

// Add IP to history
userSchema.methods.addIpToHistory = function (ip, userAgent) {
  // Keep only last 10 IPs
  if (this.ipHistory.length >= 10) {
    this.ipHistory.shift();
  }

  this.ipHistory.push({ ip, userAgent });
};

// Check if IP is suspicious
userSchema.methods.isSuspiciousIp = function (ip) {
  // If user has more than 3 different IPs in last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentIps = this.ipHistory
    .filter((entry) => entry.timestamp > twentyFourHoursAgo)
    .map((entry) => entry.ip);

  const uniqueIps = new Set(recentIps).size;
  return uniqueIps > 3;
};

module.exports = mongoose.model("User", userSchema);
