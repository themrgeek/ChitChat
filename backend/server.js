const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const compression = require("compression");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const { connectDB } = require("./src/config/database");
const authRoutes = require("./src/routes/auth");
const chatRoutes = require("./src/routes/chat");
const { setupSocket, getConnectedUsers } = require("./src/utils/socketHandler");
const { setupWebRTCSignaling } = require("./src/utils/webrtcHandler");

const app = express();
const server = http.createServer(app);

// Determine environment
const isProduction = process.env.NODE_ENV === "production";
const PORT = process.env.PORT || 3000;

// Configure CORS for both local and production
const allowedOrigins = isProduction
  ? [
      process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : "*",
      process.env.RAILWAY_STATIC_URL || "*",
      process.env.FRONTEND_URL || "*",
    ]
  : [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:5173",
      "http://localhost:8081", // React Native Expo
      "*",
    ];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // PRODUCTION OPTIMIZATION: Prefer WebSocket, fallback to polling only if needed
  transports: isProduction ? ["websocket"] : ["websocket", "polling"],
  allowUpgrades: true,
  upgradeTimeout: 10000,
  pingTimeout: 30000,
  pingInterval: 15000,
  maxHttpBufferSize: 10e6, // 10MB for file transfers
  // Reduce connection overhead
  perMessageDeflate: {
    threshold: 1024, // Only compress messages > 1KB
  },
});

// ==================== SECURITY MIDDLEWARE ====================

// Helmet for security headers (configured for React SPA)
app.use(
  helmet({
    contentSecurityPolicy: isProduction
      ? {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: [
              "'self'",
              "'unsafe-inline'",
              "https://fonts.googleapis.com",
            ],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "wss:", "ws:", "https:"],
            mediaSrc: ["'self'", "blob:"],
          },
        }
      : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 100 : 1000, // Limit requests per window
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isProduction ? 20 : 100, // Auth attempts per hour
  message: {
    error: "Too many authentication attempts, please try again later",
  },
});

app.use("/api", limiter);
app.use("/api/auth", authLimiter);

// CORS
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Trust proxy for Railway
if (isProduction) {
  app.set("trust proxy", 1);
}

// Compression - optimized for production
app.use(
  compression({
    level: isProduction ? 6 : 1, // Higher compression in production
    threshold: 512, // Compress anything > 512 bytes
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      // Don't compress already compressed formats
      const contentType = res.getHeader("Content-Type") || "";
      if (/image|video|audio/.test(contentType)) return false;
      return compression.filter(req, res);
    },
  }),
);

// ⚡ PERFORMANCE: Response timing middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - startTime;
    if (req.path.startsWith("/api")) {
      console.log(`⚡ ${req.method} ${req.path} - ${duration}ms`);
    }
  });
  // Add timing header
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    res.setHeader("X-Response-Time", `${Date.now() - startTime}ms`);
    return originalJson(body);
  };
  next();
});

// Body parsing
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ==================== STATIC FILES ====================

const clientBuildPath = path.join(__dirname, "../client/dist");
const legacyFrontendPath = path.join(__dirname, "../frontend");
const fs = require("fs");
const hasReactBuild = fs.existsSync(clientBuildPath);

// Serve static files with aggressive caching for production
app.use(
  express.static(hasReactBuild ? clientBuildPath : legacyFrontendPath, {
    maxAge: isProduction ? "1y" : 0, // 1 year cache for hashed assets
    etag: true,
    lastModified: true,
    immutable: isProduction, // Assets with hash won't change
    index: false, // Don't serve index.html from static (SPA handles it)
  }),
);

// Cache control for different asset types
app.use((req, res, next) => {
  if (isProduction) {
    // Long cache for hashed assets (JS, CSS with hash in filename)
    if (req.path.match(/\.(js|css)$/) && req.path.includes("-")) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
    // Medium cache for images and fonts
    else if (
      req.path.match(/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)
    ) {
      res.setHeader("Cache-Control", "public, max-age=604800"); // 1 week
    }
    // No cache for HTML (SPA needs fresh content)
    else if (req.path.match(/\.html$/) || req.path === "/") {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    }
  }
  next();
});

// ==================== API ROUTES ====================

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: isProduction ? "production" : "development",
    version: "2.0.0",
  });
});

// API info
app.get("/api", (req, res) => {
  res.json({
    name: "DOOT Secure Chat API",
    version: "2.0.0",
    status: "running",
    features: ["messaging", "file-sharing", "audio-calls", "video-calls"],
    environment: isProduction ? "production" : "development",
  });
});

// Auth & Chat routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);

// Terms and Privacy
app.get("/terms.html", (req, res) => {
  res.sendFile(path.join(legacyFrontendPath, "terms.html"));
});

app.get("/privacy.html", (req, res) => {
  res.sendFile(path.join(legacyFrontendPath, "privacy.html"));
});

// SPA fallback
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }

  const indexPath = hasReactBuild
    ? path.join(clientBuildPath, "index.html")
    : path.join(legacyFrontendPath, "index.html");

  res.sendFile(indexPath);
});

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.message);

  const statusCode = err.statusCode || 500;
  const message = isProduction ? "Internal server error" : err.message;

  res.status(statusCode).json({
    error: message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
});

// ==================== SOCKET.IO SETUP ====================

// Setup chat socket handlers
const connectedUsers = setupSocket(io);

// Setup WebRTC signaling for audio/video calls
setupWebRTCSignaling(io, connectedUsers);

// ==================== DATABASE & SERVER START ====================

async function startServer() {
  // Connect to MongoDB (optional - will fallback to in-memory if not available)
  if (process.env.MONGODB_URI || process.env.MONGO_URI) {
    await connectDB();
  } else {
    console.log("⚠️ No MongoDB URI provided - using in-memory storage");
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 DOOT Secure Chat server running on port ${PORT}`);
    console.log(`🔒 End-to-end encrypted messaging activated`);
    console.log(`📞 Audio/Video calling enabled`);
    console.log(
      `🌍 Environment: ${isProduction ? "Production" : "Development"}`,
    );
    if (!isProduction) {
      console.log(`📡 Local URL: http://localhost:${PORT}`);
    }
  });
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("🛑 SIGTERM received. Shutting down gracefully...");
  server.close(() => {
    console.log("👋 Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", async () => {
  console.log("🛑 SIGINT received. Shutting down gracefully...");
  server.close(() => {
    console.log("👋 Server closed");
    process.exit(0);
  });
});

startServer();
