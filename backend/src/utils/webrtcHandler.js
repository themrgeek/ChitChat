// WebRTC Signaling Handler for Audio/Video Calls
// Supports: 1:1 calls, 1:many (broadcast), many:many (conference mesh)

const activeCallSessions = new Map();
const conferenceRooms = new Map(); // For multi-participant calls

/**
 * Conference Room Structure:
 * {
 *   roomId: string,
 *   hostAvatar: string,
 *   participants: Map<avatarName, { socketId, joinedAt, hasVideo, hasAudio }>,
 *   callType: 'audio' | 'video',
 *   createdAt: Date,
 *   maxParticipants: number
 * }
 */

function generateRoomId() {
  return `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateCallId() {
  return `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function setupWebRTCSignaling(io, connectedUsers) {
  io.on("connection", (socket) => {
    // ==================== 1:1 CALL SIGNALING ====================

    // Initiate a call (1:1)
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
      const callId = generateCallId();
      activeCallSessions.set(callId, {
        callId,
        caller: callerAvatar,
        callee: targetAvatar,
        callType,
        status: "ringing",
        startedAt: new Date(),
        isConference: false,
      });

      // Send call request to target
      socket.to(targetSocketId).emit("call-incoming", {
        callId,
        callerAvatar,
        callType,
        offer,
        isConference: false,
      });

      // Notify caller that call is ringing
      socket.emit("call-ringing", {
        callId,
        targetAvatar,
        callType,
      });
    });

    // Accept incoming call (1:1)
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

    // End active call (1:1)
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

    // ICE candidate exchange (1:1)
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

    // Toggle audio/video (1:1)
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

    // ==================== CONFERENCE CALL SIGNALING (MESH) ====================

    // Create a conference room
    socket.on("conference-create", (data) => {
      const { callType, maxParticipants = 10 } = data;
      const hostAvatar = socket.avatarName;
      const roomId = generateRoomId();

      console.log(`🎥 Conference room ${roomId} created by ${hostAvatar}`);

      const room = {
        roomId,
        hostAvatar,
        participants: new Map(),
        callType: callType || "video",
        createdAt: new Date(),
        maxParticipants,
      };

      // Add host as first participant
      room.participants.set(hostAvatar, {
        socketId: socket.id,
        joinedAt: new Date(),
        hasVideo: callType === "video",
        hasAudio: true,
        isHost: true,
      });

      conferenceRooms.set(roomId, room);

      // Join socket.io room for broadcasting
      socket.join(roomId);

      socket.emit("conference-created", {
        roomId,
        hostAvatar,
        callType,
        participants: [hostAvatar],
      });
    });

    // Invite user to conference
    socket.on("conference-invite", (data) => {
      const { roomId, targetAvatar } = data;
      const targetSocketId = connectedUsers.get(targetAvatar);
      const room = conferenceRooms.get(roomId);

      if (!room) {
        socket.emit("conference-error", { message: "Room not found", roomId });
        return;
      }

      if (!targetSocketId) {
        socket.emit("conference-error", {
          message: "User is offline",
          targetAvatar,
        });
        return;
      }

      if (room.participants.size >= room.maxParticipants) {
        socket.emit("conference-error", {
          message: "Room is full",
          roomId,
        });
        return;
      }

      console.log(
        `📨 ${socket.avatarName} inviting ${targetAvatar} to room ${roomId}`,
      );

      // Get current participant list
      const participantList = Array.from(room.participants.keys());

      socket.to(targetSocketId).emit("conference-invite", {
        roomId,
        inviterAvatar: socket.avatarName,
        hostAvatar: room.hostAvatar,
        callType: room.callType,
        participants: participantList,
      });
    });

    // Join conference room
    socket.on("conference-join", (data) => {
      const { roomId } = data;
      const joinerAvatar = socket.avatarName;
      const room = conferenceRooms.get(roomId);

      if (!room) {
        socket.emit("conference-error", { message: "Room not found", roomId });
        return;
      }

      if (room.participants.size >= room.maxParticipants) {
        socket.emit("conference-error", { message: "Room is full", roomId });
        return;
      }

      console.log(`👤 ${joinerAvatar} joining conference ${roomId}`);

      // Get existing participants before adding new one
      const existingParticipants = Array.from(room.participants.entries()).map(
        ([avatar, info]) => ({
          avatar,
          socketId: info.socketId,
          hasVideo: info.hasVideo,
          hasAudio: info.hasAudio,
        }),
      );

      // Add new participant
      room.participants.set(joinerAvatar, {
        socketId: socket.id,
        joinedAt: new Date(),
        hasVideo: room.callType === "video",
        hasAudio: true,
        isHost: false,
      });

      // Join socket.io room
      socket.join(roomId);

      // Notify joiner of existing participants (for mesh connection setup)
      socket.emit("conference-joined", {
        roomId,
        callType: room.callType,
        participants: existingParticipants,
        isHost: room.hostAvatar === joinerAvatar,
      });

      // Notify existing participants of new joiner
      socket.to(roomId).emit("conference-participant-joined", {
        roomId,
        avatar: joinerAvatar,
        socketId: socket.id,
        hasVideo: room.callType === "video",
        hasAudio: true,
      });
    });

    // Conference mesh: send offer to specific participant
    socket.on("conference-offer", (data) => {
      const { roomId, targetAvatar, offer } = data;
      const room = conferenceRooms.get(roomId);

      if (!room) return;

      const targetInfo = room.participants.get(targetAvatar);
      if (!targetInfo) return;

      console.log(
        `🔗 Mesh offer: ${socket.avatarName} -> ${targetAvatar} in ${roomId}`,
      );

      socket.to(targetInfo.socketId).emit("conference-offer", {
        roomId,
        fromAvatar: socket.avatarName,
        offer,
      });
    });

    // Conference mesh: send answer to specific participant
    socket.on("conference-answer", (data) => {
      const { roomId, targetAvatar, answer } = data;
      const room = conferenceRooms.get(roomId);

      if (!room) return;

      const targetInfo = room.participants.get(targetAvatar);
      if (!targetInfo) return;

      console.log(
        `🔗 Mesh answer: ${socket.avatarName} -> ${targetAvatar} in ${roomId}`,
      );

      socket.to(targetInfo.socketId).emit("conference-answer", {
        roomId,
        fromAvatar: socket.avatarName,
        answer,
      });
    });

    // Conference mesh: ICE candidate to specific participant
    socket.on("conference-ice-candidate", (data) => {
      const { roomId, targetAvatar, candidate } = data;
      const room = conferenceRooms.get(roomId);

      if (!room) return;

      const targetInfo = room.participants.get(targetAvatar);
      if (!targetInfo) return;

      socket.to(targetInfo.socketId).emit("conference-ice-candidate", {
        roomId,
        fromAvatar: socket.avatarName,
        candidate,
      });
    });

    // Toggle media in conference
    socket.on("conference-media-toggle", (data) => {
      const { roomId, mediaType, enabled } = data;
      const room = conferenceRooms.get(roomId);

      if (!room) return;

      const participant = room.participants.get(socket.avatarName);
      if (!participant) return;

      // Update participant state
      if (mediaType === "video") {
        participant.hasVideo = enabled;
      } else if (mediaType === "audio") {
        participant.hasAudio = enabled;
      }

      // Broadcast to all participants
      socket.to(roomId).emit("conference-media-toggle", {
        roomId,
        avatar: socket.avatarName,
        mediaType,
        enabled,
      });
    });

    // Leave conference
    socket.on("conference-leave", (data) => {
      const { roomId } = data;
      handleConferenceLeave(socket, roomId, io);
    });

    // End conference (host only)
    socket.on("conference-end", (data) => {
      const { roomId } = data;
      const room = conferenceRooms.get(roomId);

      if (!room) return;

      // Only host can end conference
      if (room.hostAvatar !== socket.avatarName) {
        socket.emit("conference-error", {
          message: "Only host can end the conference",
        });
        return;
      }

      console.log(`🔚 Conference ${roomId} ended by host ${socket.avatarName}`);

      // Notify all participants
      io.to(roomId).emit("conference-ended", {
        roomId,
        endedBy: socket.avatarName,
        reason: "Host ended the conference",
      });

      // Clean up
      for (const [avatar, info] of room.participants) {
        const participantSocket = io.sockets.sockets.get(info.socketId);
        if (participantSocket) {
          participantSocket.leave(roomId);
        }
      }

      conferenceRooms.delete(roomId);
    });

    // ==================== DISCONNECT HANDLING ====================

    socket.on("disconnect", () => {
      // Handle 1:1 calls
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

      // Handle conference rooms
      for (const [roomId, room] of conferenceRooms.entries()) {
        if (room.participants.has(socket.avatarName)) {
          handleConferenceLeave(socket, roomId, io);
        }
      }
    });
  });
}

// Helper: Handle participant leaving conference
function handleConferenceLeave(socket, roomId, io) {
  const room = conferenceRooms.get(roomId);
  if (!room) return;

  const leaverAvatar = socket.avatarName;
  const wasHost = room.hostAvatar === leaverAvatar;

  console.log(`👋 ${leaverAvatar} leaving conference ${roomId}`);

  // Remove from participants
  room.participants.delete(leaverAvatar);
  socket.leave(roomId);

  // If room is empty, delete it
  if (room.participants.size === 0) {
    console.log(`🗑️ Conference ${roomId} is empty, deleting`);
    conferenceRooms.delete(roomId);
    return;
  }

  // If host left, assign new host
  if (wasHost) {
    const newHost = room.participants.keys().next().value;
    room.hostAvatar = newHost;
    console.log(`👑 New host for ${roomId}: ${newHost}`);

    io.to(roomId).emit("conference-host-changed", {
      roomId,
      newHostAvatar: newHost,
      previousHostAvatar: leaverAvatar,
    });
  }

  // Notify remaining participants
  socket.to(roomId).emit("conference-participant-left", {
    roomId,
    avatar: leaverAvatar,
    remainingParticipants: Array.from(room.participants.keys()),
  });
}

function getActiveCallSessions() {
  return activeCallSessions;
}

function getConferenceRooms() {
  return conferenceRooms;
}

function getConferenceRoom(roomId) {
  return conferenceRooms.get(roomId);
}

module.exports = {
  setupWebRTCSignaling,
  getActiveCallSessions,
  getConferenceRooms,
  getConferenceRoom,
};
