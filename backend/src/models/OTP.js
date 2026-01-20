const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true,
  },
  otp: {
    type: String,
    required: true,
  },
  avatarName: {
    type: String,
  },
  tempPassword: {
    type: String,
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: "5m" }, // Auto delete after 5 minutes
  },
});

module.exports = mongoose.model("OTP", otpSchema);
