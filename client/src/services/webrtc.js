// WebRTC Service for Audio/Video Calls - Production Ready
import { useChatStore, useUIStore } from "../store";

// ICE server configuration from environment or defaults
const getIceServers = () => {
  const servers = [
    // Google STUN servers (free, reliable)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  // Production TURN servers - CRITICAL for NAT traversal (~15% of connections need TURN)
  // Using Metered.ca free TURN servers (or configure your own)
  const turnServers = [
    {
      urls: "turn:a.relay.metered.ca:80",
      username: "83eebabf8b4cce9d5dbcb649",
      credential: "2D7JvfkOQtBdYW3R",
    },
    {
      urls: "turn:a.relay.metered.ca:80?transport=tcp",
      username: "83eebabf8b4cce9d5dbcb649",
      credential: "2D7JvfkOQtBdYW3R",
    },
    {
      urls: "turn:a.relay.metered.ca:443",
      username: "83eebabf8b4cce9d5dbcb649",
      credential: "2D7JvfkOQtBdYW3R",
    },
    {
      urls: "turn:a.relay.metered.ca:443?transport=tcp",
      username: "83eebabf8b4cce9d5dbcb649",
      credential: "2D7JvfkOQtBdYW3R",
    },
  ];

  // Add TURN servers if available from environment
  if (import.meta.env.VITE_TURN_URL) {
    servers.push({
      urls: import.meta.env.VITE_TURN_URL,
      username: import.meta.env.VITE_TURN_USERNAME || "",
      credential: import.meta.env.VITE_TURN_CREDENTIAL || "",
    });
  } else {
    // Use default Metered TURN servers
    servers.push(...turnServers);
  }

  return servers;
};

class WebRTCService {
  constructor() {
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.currentCallId = null;
    this.socket = null;
    this.callType = null;
    this.isInitiator = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.connectionQuality = "good"; // 'excellent', 'good', 'poor', 'disconnected'
    this.statsInterval = null;
    this.lastStats = null;

    // Conference/mesh support
    this.currentRoomId = null;
    this.isConference = false;
    this.peerConnections = new Map(); // Map<avatarName, RTCPeerConnection>
    this.remoteStreams = new Map(); // Map<avatarName, MediaStream>

    // ICE servers configuration (STUN/TURN)
    this.iceServers = {
      iceServers: getIceServers(),
      iceCandidatePoolSize: 10,
      iceTransportPolicy: "all", // 'all' tries STUN first, falls back to TURN
    };
  }

  setSocket(socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  setupSocketListeners() {
    if (!this.socket) return;

    // Incoming call
    this.socket.on("call-incoming", async (data) => {
      const { callId, callerAvatar, callType, offer } = data;
      console.log(`📞 Incoming ${callType} call from ${callerAvatar}`);

      this.currentCallId = callId;
      this.callType = callType;
      this.isInitiator = false;

      // Show incoming call UI
      useChatStore.getState().setIncomingCall({
        callId,
        callerAvatar,
        callType,
        offer,
      });

      useUIStore
        .getState()
        .showToast(`Incoming ${callType} call from ${callerAvatar}`, "info");
    });

    // Call accepted
    this.socket.on("call-accepted", async (data) => {
      const { callId, acceptedBy, answer } = data;
      console.log(`✅ Call accepted by ${acceptedBy}`);

      try {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer),
        );

        useChatStore.getState().setCallStatus("connected");
        useUIStore.getState().showToast("Call connected!", "success");
      } catch (error) {
        console.error("Error setting remote description:", error);
        this.endCall();
      }
    });

    // Call rejected
    this.socket.on("call-rejected", (data) => {
      const { callId, rejectedBy, reason } = data;
      console.log(`❌ Call rejected by ${rejectedBy}: ${reason}`);

      useUIStore.getState().showToast(`Call declined: ${reason}`, "error");
      this.cleanup();
      useChatStore.getState().setCallStatus(null);
    });

    // Call ended
    this.socket.on("call-ended", (data) => {
      const { callId, endedBy, reason } = data;
      console.log(`🔚 Call ended by ${endedBy}`);

      useUIStore
        .getState()
        .showToast(reason || `Call ended by ${endedBy}`, "info");
      this.cleanup();
      useChatStore.getState().setCallStatus(null);
      useChatStore.getState().setActiveCall(null);
    });

    // ICE candidate
    this.socket.on("call-ice-candidate", async (data) => {
      const { candidate } = data;
      if (this.peerConnection && candidate) {
        try {
          await this.peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate),
          );
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    // Call ringing
    this.socket.on("call-ringing", (data) => {
      const { callId, targetAvatar, callType } = data;
      this.currentCallId = callId;
      useChatStore.getState().setCallStatus("ringing");
      useUIStore.getState().showToast(`Calling ${targetAvatar}...`, "info");
    });

    // Media toggle
    this.socket.on("call-media-toggle", (data) => {
      const { mediaType, enabled, from } = data;
      useChatStore.getState().updateRemoteMediaState(mediaType, enabled);
      useUIStore
        .getState()
        .showToast(
          `${from} ${enabled ? "enabled" : "disabled"} ${mediaType}`,
          "info",
        );
    });

    // Renegotiation
    this.socket.on("call-renegotiate", async (data) => {
      const { offer, from } = data;
      try {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(offer),
        );
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);

        this.socket.emit("call-renegotiate-answer", {
          targetAvatar: from,
          answer,
          callId: this.currentCallId,
        });
      } catch (error) {
        console.error("Renegotiation error:", error);
      }
    });

    this.socket.on("call-renegotiate-answer", async (data) => {
      const { answer } = data;
      try {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
      } catch (error) {
        console.error("Error setting renegotiation answer:", error);
      }
    });

    // ==================== CONFERENCE CALL LISTENERS ====================

    // Conference created
    this.socket.on("conference-created", (data) => {
      const { roomId, hostAvatar, callType, participants } = data;
      console.log(`🎥 Conference created: ${roomId}`);

      this.currentRoomId = roomId;
      this.isConference = true;
      this.callType = callType;

      useChatStore.getState().setActiveCall({
        roomId,
        callType,
        isConference: true,
        isHost: true,
        targetAvatar: "Conference",
      });
      useChatStore.getState().setCallParticipants(participants);
      useChatStore.getState().setCallStatus("connected");

      useUIStore.getState().showToast("Conference room created!", "success");
    });

    // Conference invite received
    this.socket.on("conference-invite", (data) => {
      const { roomId, inviterAvatar, hostAvatar, callType, participants } =
        data;
      console.log(`📨 Conference invite from ${inviterAvatar}`);

      useChatStore.getState().setIncomingCall({
        roomId,
        callerAvatar: inviterAvatar,
        hostAvatar,
        callType,
        participants,
        isConference: true,
      });

      useUIStore
        .getState()
        .showToast(`${inviterAvatar} invited you to a conference`, "info");
    });

    // Joined conference
    this.socket.on("conference-joined", async (data) => {
      const { roomId, callType, participants, isHost } = data;
      console.log(
        `👤 Joined conference: ${roomId} with ${participants.length} participants`,
      );

      this.currentRoomId = roomId;
      this.isConference = true;
      this.callType = callType;

      useChatStore.getState().setActiveCall({
        roomId,
        callType,
        isConference: true,
        isHost,
        targetAvatar: "Conference",
      });
      useChatStore
        .getState()
        .setCallParticipants(participants.map((p) => p.avatar));
      useChatStore.getState().setCallStatus("connected");

      // Create mesh connections to all existing participants
      for (const participant of participants) {
        await this.createMeshConnection(participant.avatar, true);
      }

      useUIStore.getState().showToast("Joined conference!", "success");
    });

    // New participant joined conference
    this.socket.on("conference-participant-joined", async (data) => {
      const { roomId, avatar, hasVideo, hasAudio } = data;
      console.log(`👤 ${avatar} joined conference ${roomId}`);

      // Add to participants list
      const currentParticipants =
        useChatStore.getState().callParticipants || [];
      if (!currentParticipants.includes(avatar)) {
        useChatStore
          .getState()
          .setCallParticipants([...currentParticipants, avatar]);
      }

      // Wait for their offer (they will initiate to us since they are new)
      useUIStore.getState().showToast(`${avatar} joined the call`, "info");
    });

    // Participant left conference
    this.socket.on("conference-participant-left", (data) => {
      const { roomId, avatar, remainingParticipants } = data;
      console.log(`👋 ${avatar} left conference ${roomId}`);

      // Close peer connection to this participant
      this.closeMeshConnection(avatar);

      // Update participants list
      useChatStore.getState().setCallParticipants(remainingParticipants);

      useUIStore.getState().showToast(`${avatar} left the call`, "info");
    });

    // Conference host changed
    this.socket.on("conference-host-changed", (data) => {
      const { roomId, newHostAvatar, previousHostAvatar } = data;
      console.log(`👑 New host: ${newHostAvatar}`);

      const avatarName = useChatStore.getState().user?.avatarName;
      const isNewHost = newHostAvatar === avatarName;

      if (isNewHost) {
        useUIStore.getState().showToast("You are now the host", "info");
      } else {
        useUIStore
          .getState()
          .showToast(`${newHostAvatar} is now the host`, "info");
      }

      // Update active call state
      const activeCall = useChatStore.getState().activeCall;
      if (activeCall) {
        useChatStore.getState().setActiveCall({
          ...activeCall,
          isHost: isNewHost,
        });
      }
    });

    // Conference ended
    this.socket.on("conference-ended", (data) => {
      const { roomId, endedBy, reason } = data;
      console.log(`🔚 Conference ${roomId} ended by ${endedBy}`);

      useUIStore.getState().showToast(reason || "Conference ended", "info");
      this.cleanupConference();
      useChatStore.getState().setCallStatus(null);
      useChatStore.getState().setActiveCall(null);
    });

    // Conference mesh: receive offer
    this.socket.on("conference-offer", async (data) => {
      const { roomId, fromAvatar, offer } = data;
      console.log(`🔗 Received mesh offer from ${fromAvatar}`);

      try {
        // Create peer connection for this participant if needed
        let pc = this.peerConnections.get(fromAvatar);
        if (!pc) {
          pc = this.createMeshPeerConnection(fromAvatar);
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.emit("conference-answer", {
          roomId: this.currentRoomId,
          targetAvatar: fromAvatar,
          answer: pc.localDescription,
        });
      } catch (error) {
        console.error(`Error handling offer from ${fromAvatar}:`, error);
      }
    });

    // Conference mesh: receive answer
    this.socket.on("conference-answer", async (data) => {
      const { roomId, fromAvatar, answer } = data;
      console.log(`🔗 Received mesh answer from ${fromAvatar}`);

      try {
        const pc = this.peerConnections.get(fromAvatar);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } catch (error) {
        console.error(`Error handling answer from ${fromAvatar}:`, error);
      }
    });

    // Conference mesh: ICE candidate
    this.socket.on("conference-ice-candidate", async (data) => {
      const { roomId, fromAvatar, candidate } = data;

      try {
        const pc = this.peerConnections.get(fromAvatar);
        if (pc && candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (error) {
        console.error(`Error adding ICE candidate from ${fromAvatar}:`, error);
      }
    });

    // Conference media toggle
    this.socket.on("conference-media-toggle", (data) => {
      const { roomId, avatar, mediaType, enabled } = data;

      // Update remote streams state
      useChatStore
        .getState()
        .updateRemoteMediaState(mediaType, enabled, avatar);

      useUIStore
        .getState()
        .showToast(
          `${avatar} ${enabled ? "enabled" : "disabled"} ${mediaType}`,
          "info",
        );
    });

    // Conference error
    this.socket.on("conference-error", (data) => {
      const { message } = data;
      console.error("Conference error:", message);
      useUIStore.getState().showToast(message, "error");
    });
  }

  async initiateCall(targetAvatar, callType = "audio") {
    console.log(`📞 Initiating ${callType} call to ${targetAvatar}`);

    this.callType = callType;
    this.isInitiator = true;

    try {
      // Get user media
      await this.getUserMedia(callType);

      // Create peer connection
      this.createPeerConnection(targetAvatar);

      // Create and send offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === "video",
      });

      await this.peerConnection.setLocalDescription(offer);

      // Send call initiation to server
      this.socket.emit("call-initiate", {
        targetAvatar,
        callType,
        offer: this.peerConnection.localDescription,
      });

      useChatStore.getState().setCallStatus("calling");
      useChatStore.getState().setActiveCall({
        targetAvatar,
        callType,
        isInitiator: true,
      });
    } catch (error) {
      console.error("Error initiating call:", error);
      useUIStore
        .getState()
        .showToast(`Failed to start call: ${error.message}`, "error");
      this.cleanup();
    }
  }

  async acceptCall(incomingCall) {
    const { callId, callerAvatar, callType, offer } = incomingCall;
    console.log(`✅ Accepting ${callType} call from ${callerAvatar}`);

    this.callType = callType;
    this.currentCallId = callId;

    try {
      // Get user media
      await this.getUserMedia(callType);

      // Create peer connection
      this.createPeerConnection(callerAvatar);

      // Set remote description (offer)
      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer),
      );

      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send acceptance to server
      this.socket.emit("call-accept", {
        callId,
        callerAvatar,
        answer: this.peerConnection.localDescription,
      });

      useChatStore.getState().setCallStatus("connected");
      useChatStore.getState().setActiveCall({
        targetAvatar: callerAvatar,
        callType,
        isInitiator: false,
      });
      useChatStore.getState().setIncomingCall(null);
    } catch (error) {
      console.error("Error accepting call:", error);
      useUIStore
        .getState()
        .showToast(`Failed to accept call: ${error.message}`, "error");
      this.cleanup();
    }
  }

  rejectCall(incomingCall) {
    const { callId, callerAvatar } = incomingCall;
    console.log(`❌ Rejecting call from ${callerAvatar}`);

    this.socket.emit("call-reject", {
      callId,
      callerAvatar,
      reason: "Call declined",
    });

    useChatStore.getState().setIncomingCall(null);
    this.cleanup();
  }

  endCall() {
    const activeCall = useChatStore.getState().activeCall;
    if (!activeCall) return;

    console.log("🔚 Ending call");

    this.socket.emit("call-end", {
      callId: this.currentCallId,
      targetAvatar: activeCall.targetAvatar,
    });

    this.cleanup();
    useChatStore.getState().setCallStatus(null);
    useChatStore.getState().setActiveCall(null);
  }

  async getUserMedia(callType) {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video:
        callType === "video"
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: "user",
            }
          : false,
    };

    try {
      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      useChatStore.getState().setLocalStream(this.localStream);
      return this.localStream;
    } catch (error) {
      console.error("Error getting user media:", error);
      throw new Error(
        error.name === "NotAllowedError"
          ? "Microphone/camera permission denied"
          : "Could not access microphone/camera",
      );
    }
  }

  createPeerConnection(targetAvatar) {
    this.peerConnection = new RTCPeerConnection(this.iceServers);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        this.peerConnection.addTrack(track, this.localStream);
      });
    }

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("call-ice-candidate", {
          targetAvatar,
          candidate: event.candidate,
          callId: this.currentCallId,
        });
      }
    };

    // Handle ICE gathering state
    this.peerConnection.onicegatheringstatechange = () => {
      console.log(
        "ICE gathering state:",
        this.peerConnection.iceGatheringState,
      );
    };

    // Handle connection state changes with reconnection logic
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log("Connection state:", state);

      switch (state) {
        case "connected":
          this.reconnectAttempts = 0;
          this.startQualityMonitoring();
          useChatStore.getState().setConnectionQuality("good");
          break;
        case "disconnected":
          useUIStore.getState().showToast("Connection unstable...", "warning");
          useChatStore.getState().setConnectionQuality("poor");
          // Attempt to recover
          this.handleConnectionRecovery(targetAvatar);
          break;
        case "failed":
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            useUIStore
              .getState()
              .showToast(
                `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
                "warning",
              );
            this.attemptReconnect(targetAvatar);
          } else {
            useUIStore.getState().showToast("Call connection failed", "error");
            useChatStore.getState().setConnectionQuality("disconnected");
            this.endCall();
          }
          break;
        case "closed":
          this.stopQualityMonitoring();
          break;
      }
    };

    // Handle ICE connection state
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection.iceConnectionState;
      console.log("ICE state:", state);

      switch (state) {
        case "checking":
          useChatStore.getState().setCallStatus("connecting");
          break;
        case "connected":
        case "completed":
          useChatStore.getState().setCallStatus("connected");
          break;
        case "disconnected":
          useUIStore.getState().showToast("Call connection lost", "warning");
      }
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      this.remoteStream = event.streams[0];
      useChatStore.getState().setRemoteStream(this.remoteStream);
    };

    return this.peerConnection;
  }

  toggleAudio() {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;

      const activeCall = useChatStore.getState().activeCall;
      if (activeCall) {
        this.socket.emit("call-media-toggle", {
          targetAvatar: activeCall.targetAvatar,
          callId: this.currentCallId,
          mediaType: "audio",
          enabled: audioTrack.enabled,
        });
      }

      return audioTrack.enabled;
    }
    return false;
  }

  toggleVideo() {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;

      const activeCall = useChatStore.getState().activeCall;
      if (activeCall) {
        this.socket.emit("call-media-toggle", {
          targetAvatar: activeCall.targetAvatar,
          callId: this.currentCallId,
          mediaType: "video",
          enabled: videoTrack.enabled,
        });
      }

      return videoTrack.enabled;
    }
    return false;
  }

  async switchCamera() {
    if (!this.localStream || this.callType !== "video") return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    // Get current facing mode
    const settings = videoTrack.getSettings();
    const newFacingMode =
      settings.facingMode === "user" ? "environment" : "user";

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode },
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace track in peer connection
      const sender = this.peerConnection
        .getSenders()
        .find((s) => s.track?.kind === "video");

      if (sender) {
        await sender.replaceTrack(newVideoTrack);
      }

      // Stop old track and update local stream
      videoTrack.stop();
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);
      useChatStore.getState().setLocalStream(this.localStream);
    } catch (error) {
      console.error("Error switching camera:", error);
    }
  }

  cleanup() {
    // Stop quality monitoring
    this.stopQualityMonitoring();

    // Stop all tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.currentCallId = null;
    this.callType = null;
    this.isInitiator = false;
    this.reconnectAttempts = 0;
    this.connectionQuality = "good";

    useChatStore.getState().setLocalStream(null);
    useChatStore.getState().setRemoteStream(null);
    useChatStore.getState().setConnectionQuality(null);
  }

  // Connection quality monitoring
  startQualityMonitoring() {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection) return;

      try {
        const stats = await this.peerConnection.getStats();
        let qualityScore = 100;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "audio") {
            // Check packet loss
            if (report.packetsLost && report.packetsReceived) {
              const lossRate =
                report.packetsLost /
                (report.packetsReceived + report.packetsLost);
              if (lossRate > 0.1) qualityScore -= 40;
              else if (lossRate > 0.05) qualityScore -= 20;
              else if (lossRate > 0.02) qualityScore -= 10;
            }

            // Check jitter
            if (report.jitter && report.jitter > 0.1) {
              qualityScore -= 20;
            }
          }

          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            // Check round trip time
            if (report.currentRoundTripTime) {
              const rtt = report.currentRoundTripTime * 1000; // Convert to ms
              if (rtt > 400) qualityScore -= 30;
              else if (rtt > 200) qualityScore -= 15;
              else if (rtt > 100) qualityScore -= 5;
            }
          }
        });

        // Determine quality level
        let quality;
        if (qualityScore >= 80) quality = "excellent";
        else if (qualityScore >= 60) quality = "good";
        else if (qualityScore >= 40) quality = "fair";
        else quality = "poor";

        if (quality !== this.connectionQuality) {
          this.connectionQuality = quality;
          useChatStore.getState().setConnectionQuality(quality);
        }
      } catch (error) {
        console.error("Error getting stats:", error);
      }
    }, 3000); // Check every 3 seconds
  }

  stopQualityMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  // Handle connection recovery
  async handleConnectionRecovery(targetAvatar) {
    // Wait a moment to see if connection recovers naturally
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (this.peerConnection?.connectionState === "disconnected") {
      // Try ICE restart
      this.attemptReconnect(targetAvatar);
    }
  }

  // Attempt to reconnect via ICE restart
  async attemptReconnect(targetAvatar) {
    if (!this.peerConnection || !this.socket) return;

    try {
      console.log("🔄 Attempting ICE restart...");

      // Create new offer with ICE restart
      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);

      // Send renegotiation
      this.socket.emit("call-renegotiate", {
        targetAvatar,
        offer: this.peerConnection.localDescription,
        callId: this.currentCallId,
      });
    } catch (error) {
      console.error("Reconnection failed:", error);
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.endCall();
      }
    }
  }

  // Get current connection quality
  getConnectionQuality() {
    return this.connectionQuality;
  }

  // ==================== CONFERENCE CALL METHODS ====================

  // Create a new conference room
  async createConference(callType = "video") {
    console.log(`🎥 Creating ${callType} conference`);

    try {
      await this.getUserMedia(callType);
      this.isConference = true;
      this.callType = callType;

      this.socket.emit("conference-create", {
        callType,
        maxParticipants: 10,
      });

      useChatStore.getState().setCallStatus("creating");
    } catch (error) {
      console.error("Error creating conference:", error);
      useUIStore
        .getState()
        .showToast(`Failed to create conference: ${error.message}`, "error");
    }
  }

  // Invite user to conference
  inviteToConference(targetAvatar) {
    if (!this.currentRoomId) {
      console.error("No active conference room");
      return;
    }

    console.log(
      `📨 Inviting ${targetAvatar} to conference ${this.currentRoomId}`,
    );

    this.socket.emit("conference-invite", {
      roomId: this.currentRoomId,
      targetAvatar,
    });

    useUIStore.getState().showToast(`Invited ${targetAvatar}`, "info");
  }

  // Accept conference invite
  async acceptConferenceInvite(incomingCall) {
    const { roomId, callType } = incomingCall;
    console.log(`✅ Accepting conference invite to ${roomId}`);

    try {
      await this.getUserMedia(callType);
      this.isConference = true;
      this.callType = callType;

      this.socket.emit("conference-join", { roomId });
      useChatStore.getState().setIncomingCall(null);
    } catch (error) {
      console.error("Error joining conference:", error);
      useUIStore
        .getState()
        .showToast(`Failed to join: ${error.message}`, "error");
    }
  }

  // Add participant to existing call (upgrades to conference if 1:1)
  async addParticipant(targetAvatar) {
    if (this.isConference) {
      // Already in conference, just invite
      this.inviteToConference(targetAvatar);
    } else {
      // Upgrade 1:1 call to conference
      console.log("📞 Upgrading to conference call");

      const currentCall = useChatStore.getState().activeCall;
      if (!currentCall) return;

      // Create conference room
      this.socket.emit("conference-create", {
        callType: this.callType || "video",
        maxParticipants: 10,
      });

      // Wait for room creation, then invite both parties
      // The conference-created handler will set up the room
      // Store pending invite
      this._pendingConferenceInvites = [currentCall.targetAvatar, targetAvatar];
    }
  }

  // Leave conference
  leaveConference() {
    if (!this.currentRoomId) return;

    console.log(`👋 Leaving conference ${this.currentRoomId}`);

    this.socket.emit("conference-leave", {
      roomId: this.currentRoomId,
    });

    this.cleanupConference();
    useChatStore.getState().setCallStatus(null);
    useChatStore.getState().setActiveCall(null);
  }

  // End conference (host only)
  endConference() {
    if (!this.currentRoomId) return;

    console.log(`🔚 Ending conference ${this.currentRoomId}`);

    this.socket.emit("conference-end", {
      roomId: this.currentRoomId,
    });

    this.cleanupConference();
    useChatStore.getState().setCallStatus(null);
    useChatStore.getState().setActiveCall(null);
  }

  // Create mesh peer connection for a participant
  createMeshPeerConnection(targetAvatar) {
    console.log(`🔗 Creating mesh connection to ${targetAvatar}`);

    const pc = new RTCPeerConnection(this.iceServers);
    this.peerConnections.set(targetAvatar, pc);

    // Add local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit("conference-ice-candidate", {
          roomId: this.currentRoomId,
          targetAvatar,
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state
    pc.onconnectionstatechange = () => {
      console.log(`Mesh connection to ${targetAvatar}: ${pc.connectionState}`);

      if (pc.connectionState === "failed") {
        useUIStore
          .getState()
          .showToast(`Connection to ${targetAvatar} failed`, "warning");
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log(`Received track from ${targetAvatar}:`, event.track.kind);
      const stream = event.streams[0];
      this.remoteStreams.set(targetAvatar, stream);

      // Update store with all remote streams
      useChatStore
        .getState()
        .setRemoteStreams(Object.fromEntries(this.remoteStreams));
    };

    return pc;
  }

  // Create mesh connection and send offer
  async createMeshConnection(targetAvatar, sendOffer = true) {
    const pc = this.createMeshPeerConnection(targetAvatar);

    if (sendOffer) {
      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: this.callType === "video",
        });
        await pc.setLocalDescription(offer);

        this.socket.emit("conference-offer", {
          roomId: this.currentRoomId,
          targetAvatar,
          offer: pc.localDescription,
        });
      } catch (error) {
        console.error(`Error creating offer for ${targetAvatar}:`, error);
      }
    }

    return pc;
  }

  // Close mesh connection to a participant
  closeMeshConnection(targetAvatar) {
    const pc = this.peerConnections.get(targetAvatar);
    if (pc) {
      pc.close();
      this.peerConnections.delete(targetAvatar);
    }

    this.remoteStreams.delete(targetAvatar);
    useChatStore
      .getState()
      .setRemoteStreams(Object.fromEntries(this.remoteStreams));
  }

  // Toggle media in conference
  toggleConferenceAudio() {
    const enabled = this.toggleAudio();

    if (this.currentRoomId) {
      this.socket.emit("conference-media-toggle", {
        roomId: this.currentRoomId,
        mediaType: "audio",
        enabled,
      });
    }

    return enabled;
  }

  toggleConferenceVideo() {
    const enabled = this.toggleVideo();

    if (this.currentRoomId) {
      this.socket.emit("conference-media-toggle", {
        roomId: this.currentRoomId,
        mediaType: "video",
        enabled,
      });
    }

    return enabled;
  }

  // Cleanup conference state
  cleanupConference() {
    // Close all mesh peer connections
    for (const [avatar, pc] of this.peerConnections) {
      pc.close();
    }
    this.peerConnections.clear();
    this.remoteStreams.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.currentRoomId = null;
    this.isConference = false;
    this.callType = null;

    useChatStore.getState().setLocalStream(null);
    useChatStore.getState().setRemoteStreams({});
    useChatStore.getState().setCallParticipants([]);
  }

  // Override endCall to handle both 1:1 and conference
  endCallUnified() {
    if (this.isConference) {
      const activeCall = useChatStore.getState().activeCall;
      if (activeCall?.isHost) {
        this.endConference();
      } else {
        this.leaveConference();
      }
    } else {
      this.endCall();
    }
  }
}

export const webrtcService = new WebRTCService();
export default webrtcService;
