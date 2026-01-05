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
});

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Socket.io setup
setupSocket(io);

// Parse PORT with validation
let PORT;
if (process.env.PORT) {
  const parsedPort = parseInt(process.env.PORT, 10);
  if (!isNaN(parsedPort) && parsedPort >= 0 && parsedPort <= 65535) {
    PORT = parsedPort;
  } else {
    console.warn(`⚠️ Invalid PORT value: "${process.env.PORT}", using default 3000`);
    PORT = 3000;
  }
} else {
  PORT = 3000;
}
server.listen(PORT, () => {
  console.log(`🚀 ChitChat server running on port ${PORT}`);
  console.log(`🔒 Real P2P messaging system activated`);
});
