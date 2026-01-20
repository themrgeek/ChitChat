// WebRTC Signaling Handler for Audio/Video Calls
const activeCallSessions = new Map();

function setupWebRTCSignaling(io, connectedUsers) {
  io.on("connection", (socket) => {
    // ==================== VIDEO/AUDIO CALL SIGNALING ====================

    // Initiate a call
    socket.on("call-initiate", (data) => {
      const { targetAvatar, callType, offer } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);
      const callerAvatar = socket.avatarName;

      console.log(
        `📞 ${callType} call from ${callerAvatar} to ${targetAvatar}`,
      );

      if (!targetSocketId) {
        socket.emit("call-error", {
          message: "User is offline",
          targetAvatar,
        });
        return;
      }

      // Create call session
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      activeCallSessions.set(callId, {
        callId,
        caller: callerAvatar,
        callee: targetAvatar,
        callType,
        status: "ringing",
        startedAt: new Date(),
      });

      // Send call request to target
      socket.to(targetSocketId).emit("call-incoming", {
        callId,
        callerAvatar,
        callType,
        offer,
      });

      // Notify caller that call is ringing
      socket.emit("call-ringing", {
        callId,
        targetAvatar,
        callType,
      });
    });

    // Accept incoming call
    socket.on("call-accept", (data) => {
      const { callId, callerAvatar, answer } = data;
      const callerSocketId = connectedUsers.get(callerAvatar);

      console.log(`✅ Call ${callId} accepted by ${socket.avatarName}`);

      const session = activeCallSessions.get(callId);
      if (session) {
        session.status = "connected";
        session.connectedAt = new Date();
      }

      if (callerSocketId) {
        socket.to(callerSocketId).emit("call-accepted", {
          callId,
          acceptedBy: socket.avatarName,
          answer,
        });
      }
    });

    // Reject incoming call
    socket.on("call-reject", (data) => {
      const { callId, callerAvatar, reason } = data;
      const callerSocketId = connectedUsers.get(callerAvatar);

      console.log(
        `❌ Call ${callId} rejected by ${socket.avatarName}: ${reason}`,
      );

      activeCallSessions.delete(callId);

      if (callerSocketId) {
        socket.to(callerSocketId).emit("call-rejected", {
          callId,
          rejectedBy: socket.avatarName,
          reason: reason || "Call declined",
        });
      }
    });

    // End active call
    socket.on("call-end", (data) => {
      const { callId, targetAvatar } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      console.log(`🔚 Call ${callId} ended by ${socket.avatarName}`);

      const session = activeCallSessions.get(callId);
      if (session) {
        session.status = "ended";
        session.endedAt = new Date();
        session.duration = session.connectedAt
          ? (new Date() - session.connectedAt) / 1000
          : 0;
      }

      activeCallSessions.delete(callId);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("call-ended", {
          callId,
          endedBy: socket.avatarName,
        });
      }
    });

    // ICE candidate exchange
    socket.on("call-ice-candidate", (data) => {
      const { targetAvatar, candidate, callId } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("call-ice-candidate", {
          candidate,
          callId,
          from: socket.avatarName,
        });
      }
    });

    // Call renegotiation (for switching video on/off)
    socket.on("call-renegotiate", (data) => {
      const { targetAvatar, offer, callId } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("call-renegotiate", {
          offer,
          callId,
          from: socket.avatarName,
        });
      }
    });

    // Renegotiation answer
    socket.on("call-renegotiate-answer", (data) => {
      const { targetAvatar, answer, callId } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("call-renegotiate-answer", {
          answer,
          callId,
          from: socket.avatarName,
        });
      }
    });

    // Toggle audio/video
    socket.on("call-media-toggle", (data) => {
      const { targetAvatar, callId, mediaType, enabled } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);

      if (targetSocketId) {
        socket.to(targetSocketId).emit("call-media-toggle", {
          callId,
          mediaType, // 'audio' or 'video'
          enabled,
          from: socket.avatarName,
        });
      }
    });

    // Handle disconnect during call
    socket.on("disconnect", () => {
      // Find and end any active calls for this user
      for (const [callId, session] of activeCallSessions.entries()) {
        if (
          session.caller === socket.avatarName ||
          session.callee === socket.avatarName
        ) {
          const otherUser =
            session.caller === socket.avatarName
              ? session.callee
              : session.caller;
          const otherSocketId = connectedUsers.get(otherUser);

          if (otherSocketId) {
            io.to(otherSocketId).emit("call-ended", {
              callId,
              endedBy: socket.avatarName,
              reason: "User disconnected",
            });
          }

          activeCallSessions.delete(callId);
        }
      }
    });
  });
}

function getActiveCallSessions() {
  return activeCallSessions;
}

module.exports = { setupWebRTCSignaling, getActiveCallSessions };
