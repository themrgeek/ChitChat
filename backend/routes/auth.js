const express = require("express");
const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");
const User = require("../models/User");
const Session = require("../models/Session");
const Log = require("../models/Log");
const { validateRegistration } = require("../middleware/validation");

const router = express.Router();

// Register new user with identity verification
router.post("/register", validateRegistration, async (req, res) => {
  try {
    const { nationalId, email } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ nationalId }, { email }],
    });

    if (existingUser) {
      return res.status(400).json({
        error: "User with this national ID or email already exists",
      });
    }

    // Create new user
    const user = new User({
      nationalId,
      email,
      ipHistory: [{ ip, userAgent }],
    });

    // Generate anonymous credentials
    const credentials = user.generateAnonymousCredentials();
    await user.save();

    // Log the registration
    await Log.create({
      type: "user_activity",
      userId: user._id,
      ip,
      userAgent,
      action: "registration",
      details: { nationalId, email },
    });

    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      userId: user._id,
      anonymousCredentials: credentials,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Login and get anonymous credentials
router.post("/login", async (req, res) => {
  try {
    const { nationalId, email } = req.body;
    const ip = req.ip || req.connection.remoteAddress;
    const userAgent = req.get("User-Agent");

    // Find user
    const user = await User.findOne({ nationalId, email });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        error: "Account blocked",
        reason: user.blockReason,
      });
    }

    // Check for suspicious activity
    if (user.isSuspiciousIp(ip)) {
      await Log.create({
        type: "security_event",
        userId: user._id,
        ip,
        userAgent,
        action: "suspicious_login",
        severity: "high",
        details: { reason: "Multiple IP addresses in short time" },
      });
    }

    // Add IP to history
    user.addIpToHistory(ip, userAgent);
    user.lastLogin = new Date();
    await user.save();

    // Generate session
    const sessionId = uuidv4();
    const session = new Session({
      user: user._id,
      sessionId,
      ip,
      userAgent,
      avatar: user.avatar,
    });
    await session.save();

    // Log login
    await Log.create({
      type: "user_activity",
      userId: user._id,
      ip,
      userAgent,
      action: "login",
      details: { sessionId },
    });

    res.json({
      sessionId,
      anonymousId: user.anonymousId,
      avatar: user.avatar,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Verify session
router.get("/verify-session/:sessionId", async (req, res) => {
  try {
    const session = await Session.findOne({
      sessionId: req.params.sessionId,
      isActive: true,
    }).populate("user");

    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Update last activity
    session.lastActivity = new Date();
    await session.save();

    res.json({
      valid: true,
      anonymousId: session.user.anonymousId,
      avatar: session.user.avatar,
    });
  } catch (error) {
    console.error("Session verification error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
