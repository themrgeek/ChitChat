const connectedUsers = new Map();

function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);

    // User joins with their avatar name
    socket.on("user-join", async (data) => {
      const { avatarName } = data;
      connectedUsers.set(avatarName, socket.id);
      socket.avatarName = avatarName;

      console.log(`👤 User joined: ${avatarName}`);

      // Notify other users
      socket.broadcast.emit("user-online", { avatarName });
    });

    // Initiate session with another user
    socket.on("session-request", (data) => {
      const { targetAvatar, secretCode, initiatorAvatar } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      console.log(
        `📨 Session request from ${initiatorAvatar} to ${targetAvatar}`
      );

      if (targetSocketId) {
        socket.to(targetSocketId).emit("session-request", {
          initiatorAvatar,
          secretCode,
        });
        console.log(`✅ Session request delivered to ${targetAvatar}`);
      } else {
        socket.emit("session-error", {
          message: "User not online",
          targetAvatar,
        });
        console.log(`❌ User ${targetAvatar} not found`);
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
          `🔐 Secure session established between ${socket.avatarName} and ${targetAvatar}`
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
}

module.exports = { setupSocket, connectedUsers };
