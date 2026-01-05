const emailService = require("../config/emailService");

// Simple in-memory storage for demo (optimized)
const users = new Map();
const otpStore = new Map();

// User lookup cache for faster operations
const userCache = new Map();

// Performance tracking
let cacheHits = 0;
let cacheMisses = 0;
let expiredOTPsCleaned = 0;

// Background job queues
const emailJobQueue = [];
let isProcessingJobs = false;

// Background OTP job queue
const otpJobQueue = [];
let isProcessingOTPJobs = false;
let otpJobStats = { processed: 0, failed: 0, avgTime: 0, totalJobs: 0 };

// Cache management
function invalidateUserCache(avatarName) {
  userCache.delete(avatarName);
}

// Periodic cleanup of expired OTPs and cache (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  let cleanedOTPs = 0;
  let cleanedCache = 0;

  // Clean expired OTPs
  for (const [key, otpRecord] of otpStore.entries()) {
    if (otpRecord.expiresAt < now) {
      otpStore.delete(key);
      cleanedOTPs++;
    }
  }

  // Clean stale cache entries (older than 30 minutes)
  for (const [key, cacheEntry] of userCache.entries()) {
    if (now - cacheEntry.timestamp > 30 * 60 * 1000) {
      userCache.delete(key);
      cleanedCache++;
    }
  }

  expiredOTPsCleaned += cleanedOTPs;

  if (cleanedOTPs > 0 || cleanedCache > 0) {
    console.log(`🧹 Cleaned up ${cleanedOTPs} OTPs and ${cleanedCache} cache entries`);
  }
}, 5 * 60 * 1000); // 5 minutes

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

// Background email job processor
async function processEmailJobs() {
  if (isProcessingJobs || emailJobQueue.length === 0) return;

  isProcessingJobs = true;
  console.log(`📧 Starting email job processing (${emailJobQueue.length} jobs in queue)`);

  while (emailJobQueue.length > 0) {
    const job = emailJobQueue.shift();
    try {
      console.log(`📧 Processing email job for user: ${job.avatarName}`);

      const result = await emailService.sendCredentialsEmail(
        job.email,
        job.avatarName,
        job.tempPassword,
        job.etherealPassword
      );

      // Update user's email status
      const user = users.get(job.avatarName);
      if (user) {
        user.emailStatus = 'sent';
        user.emailSentAt = new Date();
        console.log(`✅ Email sent successfully for: ${job.avatarName}`);
      }

    } catch (error) {
      console.error(`❌ Email job failed for ${job.avatarName}:`, error);

      // Update user's email status on failure
      const user = users.get(job.avatarName);
      if (user) {
        user.emailStatus = 'failed';
        user.emailError = error.message;
      }
    }
  }

  isProcessingJobs = false;
  console.log(`📧 Email job processing completed`);
}

// Background OTP processor with performance tracking
async function processOTPJobs() {
  if (isProcessingOTPJobs || otpJobQueue.length === 0) return;

  isProcessingOTPJobs = true;
  const batchStart = Date.now();
  const batchSize = otpJobQueue.length;

  console.log(`📧 Processing ${batchSize} OTP email jobs`);

  while (otpJobQueue.length > 0) {
    const job = otpJobQueue.shift();
    const jobStart = Date.now();

    otpJobStats.totalJobs++;

    try {
      console.log(`📧 Sending OTP to: ${job.email} (job #${otpJobStats.totalJobs})`);

      const result = await emailService.sendOTPEmail(
        job.email,
        job.otp,
        job.avatarName,
        job.tempPassword
      );

      const jobTime = Date.now() - jobStart;
      otpJobStats.processed++;
      otpJobStats.avgTime = ((otpJobStats.avgTime * (otpJobStats.processed - 1)) + jobTime) / otpJobStats.processed;

      console.log(`✅ OTP sent to: ${job.email} (${jobTime}ms)`);

    } catch (error) {
      otpJobStats.failed++;
      console.error(`❌ OTP failed for ${job.email}:`, error.message);
    }
  }

  const batchTime = Date.now() - batchStart;
  console.log(`📧 OTP batch completed: ${batchSize} jobs in ${batchTime}ms`);
  console.log(`📊 OTP Stats: ${otpJobStats.processed} sent, ${otpJobStats.failed} failed, avg ${Math.round(otpJobStats.avgTime)}ms`);

  isProcessingOTPJobs = false;
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
  // Create new user with instant response and background email processing
  async createNewUser(req, res) {
    const startTime = Date.now();
    try {
      console.log("🎯 Received new user creation request");

      // Use cached Ethereal account (instant - no network call)
      const testAccount = await emailService.createEtherealAccount();

      // Generate unique avatar details (optimized with early collision detection)
      let avatarName;
      let attempts = 0;
      const maxAttempts = 1000;

      do {
        avatarName = SimpleAvatarGenerator.generateAvatarName();
        attempts++;

        // Fast collision check
        if (!users.has(avatarName)) {
          break; // Found unique name
        }

        // Prevent infinite loop with exponential backoff for rare cases
        if (attempts > 100 && attempts % 100 === 0) {
          console.warn(`⚠️ Avatar generation attempts: ${attempts}`);
        }

        if (attempts >= maxAttempts) {
          throw new Error("Unable to generate unique avatar name after maximum attempts");
        }
      } while (true);

      const tempPassword = SimpleAvatarGenerator.generateTempPassword();

      // Generate key pair for user
      const { publicKey, privateKey } = SimpleCryptoUtils.generateKeyPair();

      // Create user in memory immediately
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
        emailStatus: 'queued', // Track email sending status
      };

      users.set(avatarName, user);

      console.log("✅ New user created instantly:", avatarName);
      console.log("   Ethereal Email:", testAccount.email);

      // Queue email sending job (non-blocking - happens in background)
      emailJobQueue.push({
        email: testAccount.email,
        avatarName: avatarName,
        tempPassword: tempPassword,
        etherealPassword: testAccount.pass
      });

      // Start processing jobs in background (non-blocking)
      setImmediate(processEmailJobs);

      const responseTime = Date.now() - startTime;
      console.log(`⚡ User creation completed instantly in ${responseTime}ms (email queued)`);

      const response = {
        message: "Secure identity created! Here are your login credentials.",
        avatarName: avatarName,
        password: tempPassword,
        etherealEmail: testAccount.email,
        etherealPassword: testAccount.pass,
        emailStatus: "queued",
        estimatedEmailDelivery: "30-60 seconds",
        responseTime: `${responseTime}ms`,
        securityNote: "⚠️ Keep these credentials secure. They will also be emailed to you."
      };

      res.json(response);
    } catch (error) {
      console.error("❌ Create new user error:", error);
      res.status(500).json({ error: "Failed to create new user: " + error.message });
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
      res.status(500).json({ error: "Failed to get user email: " + error.message });
    }
  },

  // Get email status for a user
  async getEmailStatus(req, res) {
    try {
      const { avatarName } = req.params;

      if (!avatarName) {
        return res.status(400).json({ error: "Avatar name is required" });
      }

      const user = users.get(avatarName);

      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({
        avatarName: user.avatarName,
        emailStatus: user.emailStatus || 'unknown',
        emailSentAt: user.emailSentAt || null,
        emailError: user.emailError || null,
        createdAt: user.createdAt,
        estimatedDelivery: user.emailStatus === 'queued' ? '30-60 seconds' : null
      });
    } catch (error) {
      console.error("❌ Get email status error:", error);
      res.status(500).json({ error: "Failed to get email status: " + error.message });
    }
  },

  // Send OTP to email (ULTRA-FAST: Instant response + background processing)
  async sendOTP(req, res) {
    const requestStart = Date.now();

    try {
      console.log("📧 Received OTP request for:", req.body.email);

      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      // Validate email format (fast regex)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: "Invalid email format" });
      }

      // INSTANT OTP generation (no network calls)
      const otp = SimpleAvatarGenerator.generateOTP();
      const avatarName = SimpleAvatarGenerator.generateAvatarName();
      const tempPassword = SimpleAvatarGenerator.generateTempPassword();

      // Store OTP in memory instantly
      otpStore.set(email, {
        otp,
        avatarName,
        tempPassword,
        createdAt: new Date(),
        expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
      });

      console.log("🎯 Generated secure credentials instantly for:", email);
      console.log("   OTP:", otp);
      console.log("   Avatar:", avatarName);

      // Queue email job (non-blocking - happens in background)
      otpJobQueue.push({
        email,
        otp,
        avatarName,
        tempPassword,
        queuedAt: new Date()
      });

      // Start background processing (fire-and-forget)
      setImmediate(processOTPJobs);

      const responseTime = Date.now() - requestStart;

      // INSTANT response with delivery estimate
      const response = {
        message: "OTP sent! Check your email.",
        avatarName: avatarName,
        // Include OTP for development/testing
        otp: process.env.NODE_ENV === "production" ? undefined : otp,
        tempPassword: process.env.NODE_ENV === "production" ? undefined : tempPassword,
        emailStatus: "queued",
        estimatedDelivery: "10-30 seconds",
        responseTime: `${responseTime}ms`,
        jobQueuePosition: otpJobQueue.length
      };

      // Remove sensitive data in production
      if (process.env.NODE_ENV === "production") {
        delete response.otp;
        delete response.tempPassword;
      }

      console.log(`⚡ OTP request completed in ${responseTime}ms (email queued)`);
      res.json(response);

    } catch (error) {
      console.error("❌ Send OTP error:", error);
      const responseTime = Date.now() - requestStart;
      res.status(500).json({
        error: "Failed to send OTP: " + error.message,
        responseTime: `${responseTime}ms`
      });
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
        avatarName
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
        return res.status(400).json({ error: "Email, avatar name, and OTP are required" });
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
          error: "No login OTP found for this user. Please try logging in again.",
        });
      }

      if (otpRecord.expiresAt < Date.now()) {
        otpStore.delete(loginOTPKey);
        return res
          .status(400)
          .json({ error: "Login OTP has expired. Please try logging in again." });
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
      res.status(500).json({ error: "Failed to verify login OTP: " + error.message });
    }
  },

  // Performance monitoring endpoint
  getPerformanceStats(req, res) {
    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      users: {
        total: users.size,
        online: Array.from(users.values()).filter(u => u.isOnline).length
      },
      otps: {
        active: otpStore.size,
        expiredCleaned: expiredOTPsCleaned
      },
      emailJobs: {
        queueLength: emailJobQueue.length,
        processing: isProcessingJobs,
        stats: { processed: 0, failed: 0 } // Placeholder for now
      },
      otpJobs: {
        queueLength: otpJobQueue.length,
        processing: isProcessingOTPJobs,
        stats: otpJobStats
      },
      cache: {
        size: userCache.size,
        hits: cacheHits,
        misses: cacheMisses,
        hitRate: cacheHits + cacheMisses > 0 ? (cacheHits / (cacheHits + cacheMisses) * 100).toFixed(1) + '%' : '0%'
      }
    });
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
