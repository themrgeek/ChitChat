/**
 * Database Query Utilities for DOOT
 * Run these queries to insert/update/delete data in MongoDB
 */

const User = require("../models/User");
const OTP = require("../models/OTP");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

// ==================== USER QUERIES ====================

const userQueries = {
  // Create a new user
  async createUser({ avatarName, email, password, secretCode, publicKey }) {
    const user = new User({
      avatarName,
      email,
      password, // Will be hashed by pre-save hook
      secretCode,
      publicKey,
      isOnline: false,
      lastSeen: new Date(),
    });
    return await user.save();
  },

  // Find user by avatar name
  async findByAvatarName(avatarName) {
    return await User.findOne({ avatarName });
  },

  // Find user by email
  async findByEmail(email) {
    return await User.findOne({ email });
  },

  // Update user online status
  async setOnlineStatus(avatarName, isOnline) {
    return await User.findOneAndUpdate(
      { avatarName },
      {
        isOnline,
        lastSeen: new Date(),
      },
      { new: true },
    );
  },

  // Update public key
  async updatePublicKey(avatarName, publicKey) {
    return await User.findOneAndUpdate(
      { avatarName },
      { publicKey },
      { new: true },
    );
  },

  // Add a session (for call/chat sessions)
  async addSession(avatarName, peerAvatar, encryptedKey) {
    return await User.findOneAndUpdate(
      { avatarName },
      {
        $push: {
          sessions: {
            sessionId: uuidv4(),
            peerAvatar,
            establishedAt: new Date(),
            encryptedKey,
          },
        },
      },
      { new: true },
    );
  },

  // Remove a session
  async removeSession(avatarName, sessionId) {
    return await User.findOneAndUpdate(
      { avatarName },
      { $pull: { sessions: { sessionId } } },
      { new: true },
    );
  },

  // Get all online users
  async getOnlineUsers() {
    return await User.find({ isOnline: true }).select(
      "avatarName publicKey lastSeen",
    );
  },

  // Get all users (for admin/debug)
  async getAllUsers() {
    return await User.find().select("-password -secretCode");
  },

  // Delete user
  async deleteUser(avatarName) {
    return await User.findOneAndDelete({ avatarName });
  },

  // Verify password
  async verifyPassword(avatarName, password) {
    const user = await User.findOne({ avatarName });
    if (!user) return null;
    const isMatch = await user.correctPassword(password);
    return isMatch ? user : null;
  },
};

// ==================== OTP QUERIES ====================

const otpQueries = {
  // Create OTP
  async createOTP({ email, otp, avatarName, tempPassword }) {
    // Delete any existing OTPs for this email
    await OTP.deleteMany({ email });

    const otpDoc = new OTP({
      email,
      otp,
      avatarName,
      tempPassword,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });
    return await otpDoc.save();
  },

  // Verify OTP
  async verifyOTP(email, otp) {
    const otpDoc = await OTP.findOne({
      email,
      otp,
      expiresAt: { $gt: new Date() },
    });
    return otpDoc;
  },

  // Delete OTP after use
  async deleteOTP(email) {
    return await OTP.deleteMany({ email });
  },

  // Get OTP info (for debugging)
  async getOTPInfo(email) {
    return await OTP.findOne({ email });
  },
};

// ==================== CALL/SESSION QUERIES ====================

const callQueries = {
  // Create a call session record (if you want to persist call logs)
  async createCallSession({
    callId,
    initiatorAvatar,
    participants,
    callType,
    isConference,
  }) {
    // This would use a CallSession model if you have one
    // For now, we store in memory or via socket state
    return {
      callId: callId || uuidv4(),
      initiatorAvatar,
      participants: participants || [],
      callType,
      isConference: isConference || false,
      startTime: new Date(),
      status: "initiated",
    };
  },

  // Add participant to call
  async addParticipant(callId, participantAvatar) {
    // Update call record to add participant
    // Implementation depends on your CallSession model
    console.log(`Adding ${participantAvatar} to call ${callId}`);
  },

  // Remove participant from call
  async removeParticipant(callId, participantAvatar) {
    console.log(`Removing ${participantAvatar} from call ${callId}`);
  },

  // End call session
  async endCallSession(callId) {
    console.log(`Ending call ${callId}`);
  },
};

// ==================== MESSAGE QUERIES (if storing messages) ====================

const messageQueries = {
  // Store encrypted message
  async storeMessage({ from, to, encryptedContent, messageType = "text" }) {
    // If you have a Message model:
    // const message = new Message({ from, to, encryptedContent, messageType, timestamp: new Date() });
    // return await message.save();

    // For now, return the message object
    return {
      id: uuidv4(),
      from,
      to,
      encryptedContent,
      messageType,
      timestamp: new Date(),
    };
  },

  // Get messages between two users
  async getMessages(user1, user2, limit = 50) {
    // If you have a Message model:
    // return await Message.find({
    //   $or: [
    //     { from: user1, to: user2 },
    //     { from: user2, to: user1 }
    //   ]
    // }).sort({ timestamp: -1 }).limit(limit);
    return [];
  },
};

// ==================== EXAMPLE USAGE ====================

/*
// Create a user:
const user = await userQueries.createUser({
  avatarName: 'Shadow_Hunter_309',
  email: 'user@example.com',
  password: 'securepassword123',
  secretCode: 'SECRET123',
  publicKey: 'base64_public_key_here'
});

// Create OTP:
const otp = await otpQueries.createOTP({
  email: 'user@example.com',
  otp: '123456',
  avatarName: 'Shadow_Hunter_309',
  tempPassword: 'temp_pass_123'
});

// Verify OTP:
const verified = await otpQueries.verifyOTP('user@example.com', '123456');

// Set user online:
await userQueries.setOnlineStatus('Shadow_Hunter_309', true);

// Get all online users:
const onlineUsers = await userQueries.getOnlineUsers();
*/

module.exports = {
  userQueries,
  otpQueries,
  callQueries,
  messageQueries,
};
