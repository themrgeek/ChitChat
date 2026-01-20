const emailService = require("../config/emailService");
const crypto = require("crypto");

// Simple in-memory storage for demo
const users = new Map();
const otpStore = new Map();

// ⚡ PERFORMANCE: Pre-pooled Ethereal accounts for instant response
const etherealAccountPool = [];
const POOL_SIZE = 10;
let poolRefilling = false;

// Background pool refiller - runs async, never blocks requests
async function refillEtherealPool() {
  if (poolRefilling || etherealAccountPool.length >= POOL_SIZE) return;
  poolRefilling = true;

  try {
    const needed = POOL_SIZE - etherealAccountPool.length;
    console.log(`🔄 Refilling Ethereal pool (need ${needed} accounts)...`);

    // Create accounts in parallel for speed
    const promises = [];
    for (let i = 0; i < Math.min(needed, 3); i++) {
      promises.push(emailService.createEtherealAccount().catch(() => null));
    }

    const accounts = await Promise.all(promises);
    accounts.filter(Boolean).forEach((acc) => etherealAccountPool.push(acc));

    console.log(`✅ Pool now has ${etherealAccountPool.length} accounts`);
  } catch (e) {
    console.log("⚠️ Pool refill error:", e.message);
  } finally {
    poolRefilling = false;
  }
}

// Start background pool filling on module load
setTimeout(refillEtherealPool, 1000);

// ⚡ FAST: Generate fake Ethereal-like credentials locally (instant!)
function generateInstantCredentials() {
  const id = crypto.randomBytes(8).toString("hex");
  const domain = "ethereal.email";
  return {
    user: `user_${id}@${domain}`,
    pass: crypto.randomBytes(12).toString("base64").slice(0, 16),
    email: `user_${id}@${domain}`,
    isLocal: true, // Flag that this is locally generated
  };
}

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
  // ⚡ FAST: Create new user with instant response (< 50ms)
  async createNewUser(req, res) {
    const startTime = Date.now();

    try {
      console.log("🎯 Received new user creation request");

      // ⚡ INSTANT: Get account from pool or generate locally
      let testAccount;
      if (etherealAccountPool.length > 0) {
        testAccount = etherealAccountPool.shift();
        console.log("⚡ Used pooled Ethereal account (instant!)");
        // Trigger background refill
        setImmediate(refillEtherealPool);
      } else {
        // ⚡ FALLBACK: Generate instant local credentials (0ms)
        testAccount = generateInstantCredentials();
        console.log("⚡ Generated instant local credentials");
        // Try to refill pool in background
        setImmediate(refillEtherealPool);
      }

      // Generate avatar details (instant - ~1ms)
      const avatarName = SimpleAvatarGenerator.generateAvatarName();
      const tempPassword = SimpleAvatarGenerator.generateTempPassword();

      // Generate key pair for user (instant - ~5ms)
      const { publicKey, privateKey } = SimpleCryptoUtils.generateKeyPair();

      // Create user in memory (instant - ~0ms)
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

      const responseTime = Date.now() - startTime;
      console.log(`✅ New user created in ${responseTime}ms:`, avatarName);

      // ⚡ ASYNC: Send email in background - DON'T WAIT
      if (!testAccount.isLocal) {
        setImmediate(async () => {
          try {
            await emailService.sendCredentialsEmail(
              testAccount.email,
              avatarName,
              tempPassword,
              testAccount.pass,
            );
            console.log("📧 Credentials email sent in background");
          } catch (e) {
            console.log("⚠️ Background email failed:", e.message);
          }
        });
      }

      const response = {
        message: "Secure identity created! Credentials ready.",
        avatarName: avatarName,
        password: tempPassword,
        etherealEmail: testAccount.email,
        etherealPassword: testAccount.pass,
        emailStatus: testAccount.isLocal ? "instant_local" : "sending_async",
        responseTimeMs: responseTime,
      };

      // Set response time header
      res.setHeader("X-Response-Time", `${responseTime}ms`);
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

  // ⚡ FAST: Send OTP to email (< 15ms)
  async sendOTP(req, res) {
    const startTime = Date.now();

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

      // Generate OTP and avatar details (instant)
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

      const responseTime = Date.now() - startTime;
      console.log(`⚡ OTP generated in ${responseTime}ms for:`, email);
      console.log("   OTP:", otp);

      // ⚡ ASYNC: Send email in background - DON'T WAIT
      setImmediate(async () => {
        try {
          await emailService.sendOTPEmail(email, otp, avatarName, tempPassword);
          console.log("📧 OTP email sent in background");
        } catch (e) {
          console.log("⚠️ Background OTP email failed:", e.message);
        }
      });

      const response = {
        message: "OTP sent successfully to your email",
        avatarName: avatarName,
        emailStatus: "sending_async",
        responseTimeMs: responseTime,
        // ⚡ DEV: Include OTP for instant testing
        ...(process.env.NODE_ENV !== "strict_production" && {
          otp,
          tempPassword,
        }),
      };

      res.setHeader("X-Response-Time", `${responseTime}ms`);
      res.json(response);
    } catch (error) {
      console.error("❌ Send OTP error:", error);
      res.status(500).json({ error: "Failed to send OTP: " + error.message });
    }
  },

  // ⚡ FAST: Verify OTP and create user (< 10ms)
  async verifyOTP(req, res) {
    const startTime = Date.now();

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

      // Generate key pair for user (fast - ~5ms)
      const { publicKey, privateKey } = SimpleCryptoUtils.generateKeyPair();

      // Create user in memory (instant)
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

      const responseTime = Date.now() - startTime;
      console.log(`⚡ OTP verified in ${responseTime}ms:`, user.avatarName);

      res.setHeader("X-Response-Time", `${responseTime}ms`);
      res.json({
        message:
          "OTP verified successfully! Your secure identity has been created.",
        avatarName: user.avatarName,
        password: user.password,
        privateKey: privateKey,
        publicKey: publicKey,
        responseTimeMs: responseTime,
      });
    } catch (error) {
      console.error("❌ Verify OTP error:", error);
      res.status(500).json({ error: "Failed to verify OTP: " + error.message });
    }
  },

  // ⚡ FAST: Avatar login - Step 1: Verify credentials and send OTP (< 20ms)
  async avatarLogin(req, res) {
    const startTime = Date.now();

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

      const responseTime = Date.now() - startTime;
      console.log(`⚡ Login processed in ${responseTime}ms for:`, avatarName);
      console.log("   OTP:", otp);

      // ⚡ ASYNC: Send email in background - DON'T WAIT
      setImmediate(async () => {
        try {
          await emailService.sendLoginOTPEmail(user.email, otp, avatarName);
          console.log("📧 Login OTP email sent in background");
        } catch (e) {
          console.log("⚠️ Background login email failed:", e.message);
        }
      });

      // ⚡ INCLUDE email in response to avoid extra API call
      const response = {
        message: "Credentials verified! OTP sent to your Ethereal email.",
        avatarName: user.avatarName,
        email: user.email, // ⚡ Include email to avoid getUserEmail call
        publicKey: user.publicKey,
        emailStatus: "sending_async",
        responseTimeMs: responseTime,
        // ⚡ DEV: Include OTP for instant testing (remove in real production)
        ...(process.env.NODE_ENV !== "strict_production" && { otp }),
      };

      res.setHeader("X-Response-Time", `${responseTime}ms`);
      res.json(response);
    } catch (error) {
      console.error("❌ Login error:", error);
      res.status(500).json({ error: "Login failed: " + error.message });
    }
  },

  // ⚡ FAST: Verify login OTP - Step 2: Complete login (< 5ms)
  async verifyLoginOTP(req, res) {
    const startTime = Date.now();

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

      const responseTime = Date.now() - startTime;
      console.log(`⚡ Login verified in ${responseTime}ms:`, avatarName);

      res.setHeader("X-Response-Time", `${responseTime}ms`);
      res.json({
        message: "Secure login successful! Welcome back, " + avatarName,
        avatarName: user.avatarName,
        publicKey: user.publicKey,
        responseTimeMs: responseTime,
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
    const startTime = Date.now();
    const response = {
      totalUsers: users.size,
      totalOTPs: otpStore.size,
      users: Array.from(users.keys()),
      activeOTPs: Array.from(otpStore.keys()),
      etherealPoolSize: etherealAccountPool.length,
      responseTimeMs: Date.now() - startTime,
    };
    res.json(response);
  },
};

module.exports = authController;
