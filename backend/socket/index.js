const { Server } = require("socket.io");
const { authenticateSocket } = require("../middleware/auth");
const Session = require("../models/Session");
const Log = require("../models/Log");

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  // Socket authentication middleware
  io.use(authenticateSocket);

  io.on("connection", (socket) => {
    console.log("User connected:", socket.anonymousId);

    // Join user to their personal room
    socket.join(socket.anonymousId);

    // Handle chat messages
    socket.on("message", async (data) => {
      try {
        const { roomId, content } = data;

        // Log message
        await Log.create({
          type: "user_activity",
          userId: socket.userId,
          anonymousId: socket.anonymousId,
          ip: socket.handshake.address,
          action: "message_sent",
          details: { roomId, content: content.substring(0, 100) }, // Store first 100 chars
        });

        // Broadcast to room
        socket.to(roomId).emit("message", {
          from: socket.anonymousId,
          avatar: socket.avatar,
          content,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error("Message handling error:", error);
      }
    });

    // Handle room operations
    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit("user-joined", {
        userId: socket.anonymousId,
        avatar: socket.avatar,
      });
    });

    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
      socket.to(roomId).emit("user-left", {
        userId: socket.anonymousId,
      });
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log("User disconnected:", socket.anonymousId);

      try {
        // Update session
        await Session.findOneAndUpdate(
          { sessionId: socket.sessionId },
          { isActive: false, disconnectedAt: new Date() }
        );

        // Log disconnect
        await Log.create({
          type: "user_activity",
          userId: socket.userId,
          anonymousId: socket.anonymousId,
          ip: socket.handshake.address,
          action: "disconnect",
        });
      } catch (error) {
        console.error("Disconnect logging error:", error);
      }
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized");
  }
  return io;
};

module.exports = { initSocket, getIO };
