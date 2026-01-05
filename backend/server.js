const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");
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
  },
  // Performance optimizations
  pingTimeout: 60000, // 60 seconds
  pingInterval: 25000, // 25 seconds
  transports: ['websocket', 'polling'], // Prefer websockets
  allowEIO3: true, // Allow Engine.IO v3 clients
});

// Response time logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`⚡ ${req.method} ${req.originalUrl} - ${duration}ms`);
  });
  next();
});

// Performance optimizations
app.set('trust proxy', 1); // Trust first proxy for faster header parsing
app.disable('x-powered-by'); // Remove X-Powered-By header for security/performance

// Middleware (optimized order for performance)
app.use(cors({
  origin: true, // Allow all origins for now
  credentials: true
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static file serving with caching headers
app.use(express.static(path.join(__dirname, "../frontend"), {
  maxAge: '1h', // Cache static files for 1 hour
  etag: true
}));

// Routes
app.use("/api/auth", authRoutes);
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
