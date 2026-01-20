// ⚡ PERFORMANCE: Use Map for O(1) lookups
const connectedUsers = new Map();

// ⚡ Pre-allocate common response objects
const userNotFoundResponse = { message: "User not online" };

function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);

    // ⚡ FAST: User joins with their avatar name
    socket.on("user-join", (data) => {
      const { avatarName } = data;
      connectedUsers.set(avatarName, socket.id);
      socket.avatarName = avatarName;

      console.log(`👤 User joined: ${avatarName}`);

      // ⚡ Broadcast async to not block
      setImmediate(() => {
        socket.broadcast.emit("user-online", { avatarName });
      });
    });

    // ⚡ FAST: Initiate session with another user
    socket.on("session-request", (data) => {
      const { targetAvatar, secretCode, initiatorAvatar } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("session-request", {
          initiatorAvatar,
          secretCode,
        });
      } else {
        socket.emit("session-error", {
          ...userNotFoundResponse,
          targetAvatar,
        });
      }
    });

    // Accept session request
    socket.on("session-accept", (data) => {
      const { targetAvatar, sessionKey } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      console.log(`✅ Session accepted for ${targetAvatar}`);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("session-established", {
          sessionKey,
          peerAvatar: socket.avatarName,
        });

        // Also notify the acceptor
        socket.emit("session-established", {
          sessionKey,
          peerAvatar: targetAvatar,
        });

        console.log(
          `🔐 Secure session established between ${socket.avatarName} and ${targetAvatar}`,
        );
      }
    });

    // Send encrypted message
    socket.on("send-message", (data) => {
      const { targetAvatar, encryptedMessage, messageId } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      console.log(`💬 Message from ${socket.avatarName} to ${targetAvatar}`);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("new-message", {
          encryptedMessage,
          messageId,
          from: socket.avatarName,
          timestamp: new Date(),
        });

        // Send read receipt after 1 second
        setTimeout(() => {
          socket.to(targetSocketId).emit("message-read", { messageId });
        }, 1000);
      }
    });

    // Send file
    socket.on("send-file", (data) => {
      const { targetAvatar, fileData, fileName, fileType } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      console.log(`📁 File sent from ${socket.avatarName} to ${targetAvatar}`);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("file-received", {
          fileData,
          fileName,
          fileType,
          from: socket.avatarName,
          timestamp: new Date(),
        });
      }
    });

    // Typing indicators
    socket.on("typing-start", (data) => {
      const { targetAvatar } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("user-typing", {
          avatarName: socket.avatarName,
          isTyping: true,
        });
      }
    });

    socket.on("typing-stop", (data) => {
      const { targetAvatar } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("user-typing", {
          avatarName: socket.avatarName,
          isTyping: false,
        });
      }
    });

    // End session
    socket.on("end-session", (data) => {
      const { targetAvatar } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      console.log(
        `🔚 Session ended by ${socket.avatarName} with ${targetAvatar}`,
      );

      if (targetSocketId) {
        // Notify the other user that session has ended
        socket.to(targetSocketId).emit("session-ended", {
          endedBy: socket.avatarName,
          message: "The session has been terminated by the other participant.",
        });
      }

      // Also notify the session ender
      socket.emit("session-ended", {
        endedBy: socket.avatarName,
        message: "You have ended the session.",
      });
    });

    // Handle disconnection
    socket.on("disconnect", () => {
      console.log(`🔌 User disconnected: ${socket.id}`);

      if (socket.avatarName) {
        connectedUsers.delete(socket.avatarName);
        socket.broadcast.emit("user-offline", {
          avatarName: socket.avatarName,
        });
      }
    });
  });

  // Return connectedUsers so WebRTC handler can access it
  return connectedUsers;
}

function getConnectedUsers() {
  return connectedUsers;
}

module.exports = { setupSocket, getConnectedUsers, connectedUsers };
