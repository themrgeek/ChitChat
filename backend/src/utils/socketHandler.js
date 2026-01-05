const connectedUsers = new Map();

// Background job queues for heavy operations
const fileJobQueue = [];
let isProcessingFileJobs = false;

// Background file processor
async function processFileJobs() {
  if (isProcessingFileJobs || fileJobQueue.length === 0) return;

  isProcessingFileJobs = true;
  console.log(`📁 Processing ${fileJobQueue.length} file jobs`);

  while (fileJobQueue.length > 0) {
    const job = fileJobQueue.shift();
    try {
      console.log(`📁 Delivering file from ${job.from} to ${job.targetAvatar}`);

      // Deliver the file
      job.socket.to(job.targetSocketId).emit("file-received", {
        fileData: job.fileData,
        fileName: job.fileName,
        fileType: job.fileType,
        from: job.from,
        timestamp: new Date(),
      });

      console.log(`✅ File delivered: ${job.fileName}`);
    } catch (error) {
      console.error(`❌ File delivery failed: ${error.message}`);
    }
  }

  isProcessingFileJobs = false;
}

function setupSocket(io) {
  io.on("connection", (socket) => {
    console.log(`🔗 User connected: ${socket.id}`);

    // User joins with their avatar name (optimized)
    socket.on("user-join", (data) => {
      const { avatarName } = data;

      // Fast user registration
      connectedUsers.set(avatarName, socket.id);
      socket.avatarName = avatarName;

      // Notify other users of online status
      socket.broadcast.emit("user-online", { avatarName });

      console.log(`👤 User online: ${avatarName} (${connectedUsers.size} total)`);
    });

    // Initiate session with another user (optimized)
    socket.on("session-request", (data) => {
      const { targetAvatar, secretCode, initiatorAvatar } = data;

      // Fast user lookup
      const targetSocketId = connectedUsers.get(targetAvatar);

      if (targetSocketId) {
        // Deliver session request immediately
        socket.to(targetSocketId).emit("session-request", {
          initiatorAvatar,
          secretCode,
        });

        // Log success (minimal logging for performance)
        console.log(`📨 Session: ${initiatorAvatar} → ${targetAvatar}`);
      } else {
        // User not online - fast failure response
        socket.emit("session-error", {
          message: "User not online",
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
          `🔐 Secure session established between ${socket.avatarName} and ${targetAvatar}`
        );
      }
    });

    // Send encrypted message (optimized)
    socket.on("send-message", (data) => {
      const { targetAvatar, encryptedMessage, messageId } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      if (targetSocketId) {
        // Send message immediately
        socket.to(targetSocketId).emit("new-message", {
          encryptedMessage,
          messageId,
          from: socket.avatarName,
          timestamp: new Date(),
        });

        // Send read receipt after 1 second (non-blocking)
        setImmediate(() => {
          setTimeout(() => {
            try {
              socket.to(targetSocketId).emit("message-read", { messageId });
            } catch (error) {
              // Socket might be disconnected, ignore
            }
          }, 1000);
        });

        console.log(`💬 Message delivered: ${socket.avatarName} → ${targetAvatar}`);
      } else {
        // User not online, could implement offline message queuing here
        socket.emit("message-error", {
          messageId,
          error: "User not online"
        });
      }
    });

    // Send file (optimized with background processing)
    socket.on("send-file", (data) => {
      const { targetAvatar, fileData, fileName, fileType } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      console.log(`📁 File queued from ${socket.avatarName} to ${targetAvatar}`);

      if (targetSocketId) {
        // For large files (>100KB), use background processing
        const fileSizeKB = (fileData.length * 3) / 4 / 1024; // Base64 overhead

        if (fileSizeKB > 100) {
          // Queue for background processing
          fileJobQueue.push({
            socket,
            targetSocketId,
            targetAvatar,
            fileData,
            fileName,
            fileType,
            from: socket.avatarName
          });

          // Start processing in background
          setImmediate(processFileJobs);

          // Immediate acknowledgment
          socket.emit("file-queued", {
            fileName,
            targetAvatar,
            estimatedDelivery: "5-10 seconds"
          });
        } else {
          // Small files: deliver immediately
          socket.to(targetSocketId).emit("file-received", {
            fileData,
            fileName,
            fileType,
            from: socket.avatarName,
            timestamp: new Date(),
          });

          console.log(`✅ Small file delivered immediately: ${fileName}`);
        }
      } else {
        socket.emit("file-error", {
          fileName,
          message: "Recipient not online"
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

      console.log(`🔚 Session ended by ${socket.avatarName} with ${targetAvatar}`);

      if (targetSocketId) {
        // Notify the other user that session has ended
        socket.to(targetSocketId).emit("session-ended", {
          endedBy: socket.avatarName,
          message: "The session has been terminated by the other participant."
        });
      }

      // Also notify the session ender
      socket.emit("session-ended", {
        endedBy: socket.avatarName,
        message: "You have ended the session."
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
}

module.exports = { setupSocket, connectedUsers };
