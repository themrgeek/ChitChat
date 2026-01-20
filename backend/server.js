const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
const path = require("path");
const compression = require("compression");
require("dotenv").config();

const authRoutes = require("./src/routes/auth");
const chatRoutes = require("./src/routes/chat");
const { setupSocket } = require("./src/utils/socketHandler");

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
    ]
  : ["http://localhost:3000", "http://127.0.0.1:3000", "*"];

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // Railway-specific settings for WebSocket
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Middleware
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);

// Trust proxy for Railway (needed for secure cookies, proper IP detection)
if (isProduction) {
  app.set("trust proxy", 1);
}

// Enable gzip compression for all responses
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Serve static files with caching headers for production
app.use(express.static(path.join(__dirname, "../frontend"), {
  maxAge: isProduction ? '1d' : 0,
  etag: true,
  lastModified: true
}));

// Health check endpoint for Railway
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    environment: isProduction ? "production" : "development",
  });
});

// API info endpoint
app.get("/api", (req, res) => {
  res.json({
    name: "ChitChat API",
    version: "1.0.1",
    status: "running",
    environment: isProduction ? "production" : "development",
  });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);

// Serve frontend for all non-API routes (SPA support)
app.get("*", (req, res) => {
  // Don't serve index.html for API routes
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Socket.io setup
setupSocket(io);

// Start server
server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 ChitChat server running on port ${PORT}`);
  console.log(`🔒 Secure P2P messaging system activated`);
  console.log(`🌍 Environment: ${isProduction ? "Production" : "Development"}`);
  if (!isProduction) {
    console.log(`📡 Local URL: http://localhost:${PORT}`);
  }
});
