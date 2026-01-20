const emailService = require("../config/emailService");
const crypto = require("crypto");

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
    // Use crypto for secure password generation
    return crypto.randomBytes(8).toString("base64").slice(0, 12);
  }

  static generateOTP() {
    // Use crypto for secure OTP generation
    return crypto.randomInt(100000, 999999).toString();
  }
}

// Proper crypto utils using Node.js crypto module
class SimpleCryptoUtils {
  static generateKeyPair() {
    try {
      // Generate proper ECDH keys for production (faster than RSA, secure)
      const keyPair = crypto.generateKeyPairSync("ec", {
        namedCurve: "secp256k1",
        publicKeyEncoding: {
          type: "spki",
          format: "pem",
        },
        privateKeyEncoding: {
          type: "pkcs8",
          format: "pem",
        },
      });
      return {
        publicKey: keyPair.publicKey,
        privateKey: keyPair.privateKey,
      };
    } catch (error) {
      console.error("Key generation error, using fallback:", error.message);
      // Fallback for environments without full crypto support
      const randomId = crypto.randomBytes(32).toString("hex");
      return {
        publicKey: `pk_${randomId}`,
        privateKey: `sk_${crypto.randomBytes(32).toString("hex")}`,
      };
    }
  }

  static generateSecureToken(length = 32) {
    return crypto.randomBytes(length).toString("hex");
  }
}

const authController = {
  // Create new user with auto-generated Ethereal email
  async createNewUser(req, res) {
    try {
      console.log("🎯 Received new user creation request");

      // Generate Ethereal email credentials
      const testAccount = await emailService.createEtherealAccount();

      // Generate avatar details
      const avatarName = SimpleAvatarGenerator.generateAvatarName();
      const tempPassword = SimpleAvatarGenerator.generateTempPassword();

      // Generate key pair for user
      const { publicKey, privateKey } = SimpleCryptoUtils.generateKeyPair();

      // Create user in memory
      const user = {
        avatarName: avatarName,
        password: tempPassword,
        email: testAccount.email,
        etherealCredentials: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
        publicKey: publicKey,
        privateKey: privateKey,
        createdAt: new Date(),
        isOnline: false,
        lastSeen: new Date(),
      };

      users.set(avatarName, user);

      console.log("✅ New user created successfully:", avatarName);
      console.log("   Ethereal Email:", testAccount.email);

      // Send credentials to the Ethereal email
      const emailResult = await emailService.sendCredentialsEmail(
        testAccount.email,
        avatarName,
        tempPassword,
        testAccount.pass, // Include Ethereal email password
      );

      const response = {
        message: "Secure identity created! Credentials sent to Ethereal email.",
        avatarName: avatarName,
        password: tempPassword,
        etherealEmail: testAccount.email,
        etherealPassword: testAccount.pass,
        emailStatus: emailResult.fallback ? "console_fallback" : "sent",
      };

      // Always send credentials - users need them to login
      // Ethereal is a test email service, so credentials are safe to display
      res.json(response);
    } catch (error) {
      console.error("❌ Create new user error:", error);
      res
        .status(500)
        .json({ error: "Failed to create new user: " + error.message });
    }
  },

  // Get user email by avatar name
  async getUserEmail(req, res) {
    try {
      const { avatarName } = req.params;

      if (!avatarName) {
        return res.status(400).json({ error: "Avatar name is required" });
      }

      const user = users.get(avatarName);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ email: user.email });
    } catch (error) {
      console.error("❌ Get user email error:", error);
      res
        .status(500)
        .json({ error: "Failed to get user email: " + error.message });
    }
  },

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
        tempPassword,
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

  // Avatar login - Step 1: Verify credentials and send OTP
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

      // Generate OTP and store for login verification
      const otp = SimpleAvatarGenerator.generateOTP();

      // Store login OTP (separate from registration OTP)
      const loginOTPKey = `login_${avatarName}`;
      otpStore.set(loginOTPKey, {
        otp,
        avatarName,
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      });

      console.log("🎯 Generated login OTP for:", avatarName);
      console.log("   OTP:", otp);

      // Send OTP to user's Ethereal email
      const emailResult = await emailService.sendLoginOTPEmail(
        user.email,
        otp,
        avatarName,
      );

      console.log("✅ Login OTP sent for:", avatarName);

      res.json({
        message: "Credentials verified! OTP sent to your Ethereal email.",
        avatarName: user.avatarName,
        publicKey: user.publicKey,
        emailStatus: emailResult.fallback ? "console_fallback" : "sent",
      });
    } catch (error) {
      console.error("❌ Login error:", error);
      res.status(500).json({ error: "Login failed: " + error.message });
    }
  },

  // Verify login OTP - Step 2: Complete login
  async verifyLoginOTP(req, res) {
    try {
      console.log("🔐 Received login OTP verification request");

      const { email, avatarName, otp } = req.body;

      if (!email || !avatarName || !otp) {
        return res
          .status(400)
          .json({ error: "Email, avatar name, and OTP are required" });
      }

      // Find user by avatar name (more reliable than email since emails are shared)
      const user = users.get(avatarName);

      if (!user) {
        return res.status(400).json({ error: "User not found" });
      }

      // Verify the email matches (extra security check)
      if (user.email !== email) {
        return res.status(400).json({ error: "Email mismatch" });
      }

      const loginOTPKey = `login_${avatarName}`;
      const otpRecord = otpStore.get(loginOTPKey);

      if (!otpRecord) {
        return res.status(400).json({
          error:
            "No login OTP found for this user. Please try logging in again.",
        });
      }

      if (otpRecord.expiresAt < Date.now()) {
        otpStore.delete(loginOTPKey);
        return res.status(400).json({
          error: "Login OTP has expired. Please try logging in again.",
        });
      }

      if (otpRecord.otp !== otp) {
        return res
          .status(400)
          .json({ error: "Invalid login OTP. Please check and try again." });
      }

      // Update user status - now they're fully logged in
      user.isOnline = true;
      user.lastSeen = new Date();

      // Delete used OTP
      otpStore.delete(loginOTPKey);

      console.log("✅ Login OTP verified for:", avatarName);

      res.json({
        message: "Secure login successful! Welcome back, " + avatarName,
        avatarName: user.avatarName,
        publicKey: user.publicKey,
      });
    } catch (error) {
      console.error("❌ Verify login OTP error:", error);
      res
        .status(500)
        .json({ error: "Failed to verify login OTP: " + error.message });
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
