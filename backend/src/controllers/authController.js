const emailService = require("../config/emailService");

// Simple in-memory storage for demo
const users = new Map();
const otpStore = new Map();

// Simple avatar generator
class SimpleAvatarGenerator {
  static generateAvatarName() {
    const adjectives = [
      "Shadow",
      "Ghost",
      "Stealth",
      "Cyber",
      "Dark",
      "Silent",
      "Phantom",
      "Zero",
      "Binary",
      "Quantum",
    ];
    const nouns = [
      "Hunter",
      "Operator",
      "Watcher",
      "Agent",
      "Phantom",
      "Runner",
      "Byte",
      "Cipher",
      "Node",
      "Stream",
    ];
    const num = Math.floor(Math.random() * 999) + 1;
    const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
    const noun = nouns[Math.floor(Math.random() * nouns.length)];
    return `${adj}_${noun}_${num}`;
  }

  static generateTempPassword() {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
    let password = "";
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  }

  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
}

// Simple crypto utils
class SimpleCryptoUtils {
  static generateKeyPair() {
    return {
      publicKey: "pub-" + Math.random().toString(36).substring(2, 15),
      privateKey: "priv-" + Math.random().toString(36).substring(2, 15),
    };
  }
}

const authController = {
  // Send OTP to email
  async sendOTP(req, res) {
    try {
      console.log("📧 Received OTP request for:", req.body.email);

      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // Generate OTP and avatar details
      const otp = SimpleAvatarGenerator.generateOTP();
      const avatarName = SimpleAvatarGenerator.generateAvatarName();
      const tempPassword = SimpleAvatarGenerator.generateTempPassword();

      // Store OTP in memory (expires in 5 minutes)
      otpStore.set(email, {
        otp,
        avatarName,
        tempPassword,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      console.log("🎯 Generated secure credentials for:", email);
      console.log("   OTP:", otp);
      console.log("   Avatar:", avatarName);
      console.log("   Password:", tempPassword);

      // Send email with OTP
      const emailResult = await emailService.sendOTPEmail(
        email,
        otp,
        avatarName,
        tempPassword
      );

      const response = {
        message: "OTP sent successfully to your email",
        avatarName: avatarName,
        // For development, include OTP in response. Remove in production.
        otp: process.env.NODE_ENV === "production" ? undefined : otp,
        tempPassword:
          process.env.NODE_ENV === "production" ? undefined : tempPassword,
        emailStatus: emailResult.fallback ? "console_fallback" : "sent",
      };

      // Remove sensitive data in production
      if (process.env.NODE_ENV === "production") {
        delete response.otp;
        delete response.tempPassword;
      }

      res.json(response);
    } catch (error) {
      console.error("❌ Send OTP error:", error);
      res.status(500).json({ error: "Failed to send OTP: " + error.message });
    }
  },

  // Verify OTP and create user
  async verifyOTP(req, res) {
    try {
      console.log("🔐 Received OTP verification request");

      const { email, otp } = req.body;

      if (!email || !otp) {
        return res.status(400).json({ error: "Email and OTP are required" });
      }

      const otpRecord = otpStore.get(email);

      if (!otpRecord) {
        return res.status(400).json({
          error: "No OTP found for this email. Please request a new OTP.",
        });
      }

      if (otpRecord.expiresAt < Date.now()) {
        otpStore.delete(email);
        return res
          .status(400)
          .json({ error: "OTP has expired. Please request a new OTP." });
      }

      if (otpRecord.otp !== otp) {
        return res
          .status(400)
          .json({ error: "Invalid OTP. Please check and try again." });
      }

      // Generate key pair for user
      const { publicKey, privateKey } = SimpleCryptoUtils.generateKeyPair();

      // Create user in memory
      const user = {
        avatarName: otpRecord.avatarName,
        password: otpRecord.tempPassword,
        email: email,
        publicKey: publicKey,
        privateKey: privateKey,
        createdAt: new Date(),
        isOnline: false,
        lastSeen: new Date(),
      };

      users.set(otpRecord.avatarName, user);

      // Delete used OTP
      otpStore.delete(email);

      console.log("✅ User created successfully:", user.avatarName);

      res.json({
        message:
          "OTP verified successfully! Your secure identity has been created.",
        avatarName: user.avatarName,
        password: user.password,
        privateKey: privateKey,
        publicKey: publicKey,
      });
    } catch (error) {
      console.error("❌ Verify OTP error:", error);
      res.status(500).json({ error: "Failed to verify OTP: " + error.message });
    }
  },

  // Avatar login
  async avatarLogin(req, res) {
    try {
      console.log("👤 Received login request:", req.body.avatarName);

      const { avatarName, password } = req.body;

      if (!avatarName || !password) {
        return res
          .status(400)
          .json({ error: "Avatar name and password are required" });
      }

      const user = users.get(avatarName);

      if (!user) {
        return res
          .status(401)
          .json({ error: "Avatar not found. Please verify your credentials." });
      }

      if (user.password !== password) {
        return res
          .status(401)
          .json({ error: "Invalid password. Please try again." });
      }

      // Update user status
      user.isOnline = true;
      user.lastSeen = new Date();

      console.log("✅ Login successful for:", avatarName);

      res.json({
        message: "Secure login successful! Welcome back, " + avatarName,
        avatarName: user.avatarName,
        publicKey: user.publicKey,
      });
    } catch (error) {
      console.error("❌ Login error:", error);
      res.status(500).json({ error: "Login failed: " + error.message });
    }
  },

  // Debug endpoint to see current state
  debugState(req, res) {
    res.json({
      totalUsers: users.size,
      totalOTPs: otpStore.size,
      users: Array.from(users.keys()),
      activeOTPs: Array.from(otpStore.keys()),
    });
  },
};

module.exports = authController;
