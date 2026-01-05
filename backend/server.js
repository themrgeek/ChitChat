const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const path = require("path");
require("dotenv").config();

const authRoutes = require("./src/routes/auth");
const chatRoutes = require("./src/routes/chat");
const { setupSocket } = require("./src/utils/socketHandler");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Ultra-fast Socket.IO optimizations
  pingTimeout: 30000, // Reduced from 60s for faster disconnect detection
  pingInterval: 15000, // Reduced from 25s for more responsive connections
  transports: ["websocket", "polling"], // Prefer websockets for speed
  allowEIO3: true,
  // Additional performance optimizations
  connectTimeout: 10000, // Faster connection timeout
  maxHttpBufferSize: 1e6, // 1MB limit for messages
  httpCompression: true, // Enable HTTP compression
  perMessageDeflate: {
    threshold: 1024, // Compress messages > 1KB
    zlibDeflateOptions: {
      level: 6, // Compression level
    },
  },
});

// Response time logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    // Only log slow requests (>500ms) or API calls to reduce noise
    if (duration > 500) {
      console.log(`🐌 SLOW: ${req.method} ${req.originalUrl} - ${duration}ms`);
    } else if (req.originalUrl.includes("/api/")) {
      console.log(`⚡ ${req.method} ${req.originalUrl} - ${duration}ms`);
    }
  });
  next();
});

// Performance optimizations
app.set("trust proxy", 1);
app.disable("x-powered-by");

// Add compression for all responses (major performance boost)
app.use(
  compression({
    level: 6, // Good balance of speed vs compression
    threshold: 1024, // Only compress responses > 1KB
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
  })
);

// Rate limiting to prevent abuse
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: 15 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limits for auth endpoints
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit auth attempts
  message: {
    error: "Too many authentication attempts, please wait 5 minutes.",
    retryAfter: 5 * 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware (optimized order for performance)
app.use(limiter); // General rate limiting

app.use(
  cors({
    origin: true,
    credentials: true,
    maxAge: 86400, // Cache preflight for 24 hours
  })
);

// Optimize JSON parsing with smaller limits for better performance
app.use(
  express.json({
    limit: "10mb", // Reduced from 50mb
    strict: true,
  })
);
app.use(
  express.urlencoded({
    extended: false, // Faster than extended: true
    limit: "10mb",
  })
);

// Aggressive static file caching for maximum performance
app.use(
  express.static(path.join(__dirname, "../frontend"), {
    maxAge: "24h", // Cache for 24 hours (was 1 hour)
    etag: true,
    lastModified: true,
    setHeaders: (res, path) => {
      // Different cache strategies for different file types
      if (path.endsWith(".js") || path.endsWith(".css")) {
        res.setHeader("Cache-Control", "public, max-age=86400, immutable");
      } else if (path.endsWith(".html")) {
        res.setHeader("Cache-Control", "public, max-age=3600"); // 1 hour for HTML
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400"); // 24 hours for others
      }
    },
  })
);

// Health check endpoint for Railway monitoring
app.get("/health", (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
      external: Math.round(process.memoryUsage().external / 1024 / 1024) + "MB",
    },
    version: process.version,
    platform: process.platform,
    environment: process.env.NODE_ENV || "development",
  };

  // Basic health checks
  const criticalChecks = {
    serverRunning: true,
    memoryOK: process.memoryUsage().heapUsed < 100 * 1024 * 1024, // < 100MB
    uptimeOK: process.uptime() > 5, // At least 5 seconds uptime
  };

  health.checks = criticalChecks;

  // Return 200 if all critical services are OK
  const allHealthy = Object.values(criticalChecks).every(
    (check) => check === true
  );
  res.status(allHealthy ? 200 : 503).json(health);
});

// Routes with rate limiting
app.use("/api/auth", authLimiter, authRoutes); // Stricter limits for auth
app.use("/api/chat", chatRoutes);

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Socket.io setup
setupSocket(io);

// Parse PORT with enhanced validation for Railway
console.log(`🔍 Railway Environment Debug:`);
console.log(`   PORT: "${process.env.PORT}"`);
console.log(`   RAILWAY_STATIC_URL: "${process.env.RAILWAY_STATIC_URL}"`);
console.log(`   NODE_ENV: "${process.env.NODE_ENV}"`);

let PORT;
if (process.env.PORT) {
  const portValue = process.env.PORT.trim();

  // Handle case where PORT might be set to a URL (Railway issue)
  if (portValue.includes("://")) {
    console.warn(`⚠️ PORT set to URL: "${portValue}", using default 3000`);
    PORT = 3000;
  } else {
    const parsedPort = parseInt(portValue, 10);
    if (!isNaN(parsedPort) && parsedPort >= 0 && parsedPort <= 65535) {
      PORT = parsedPort;
      console.log(`✅ Using Railway-assigned PORT: ${PORT}`);
    } else {
      console.warn(
        `⚠️ Invalid PORT value: "${portValue}" (parsed: ${parsedPort}), using default 3000`
      );
      PORT = 3000;
    }
  }
} else {
  console.log(`ℹ️ No PORT specified, using default 3000`);
  PORT = 3000;
}
server.listen(PORT, () => {
  console.log(`🚀 ChitChat server running on port ${PORT}`);
  console.log(`🔒 Real P2P messaging system activated`);
});
