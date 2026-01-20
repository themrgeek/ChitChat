// WebRTC Service for React Native - Production Ready
import {
  mediaDevices,
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from "react-native-webrtc";

// ICE server configuration - same TURN servers as web client
const getIceServers = () => {
  return [
    // Google STUN servers (free, reliable)
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },

    // Production TURN servers - CRITICAL for NAT traversal
    // Using Metered.ca free TURN servers
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
    this.connectionQuality = "good";
    this.statsInterval = null;

    // Callbacks for state updates
    this.onCallStatusChange = null;
    this.onLocalStreamChange = null;
    this.onRemoteStreamChange = null;
    this.onConnectionQualityChange = null;
    this.onIncomingCall = null;
    this.onCallEnded = null;
    this.onError = null;

    this.iceServers = {
      iceServers: getIceServers(),
      iceCandidatePoolSize: 10,
      iceTransportPolicy: "all",
    };
  }

  setSocket(socket) {
    this.socket = socket;
    this.setupSocketListeners();
  }

  setCallbacks({
    onCallStatusChange,
    onLocalStreamChange,
    onRemoteStreamChange,
    onConnectionQualityChange,
    onIncomingCall,
    onCallEnded,
    onError,
  }) {
    this.onCallStatusChange = onCallStatusChange;
    this.onLocalStreamChange = onLocalStreamChange;
    this.onRemoteStreamChange = onRemoteStreamChange;
    this.onConnectionQualityChange = onConnectionQualityChange;
    this.onIncomingCall = onIncomingCall;
    this.onCallEnded = onCallEnded;
    this.onError = onError;
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

      this.onIncomingCall?.({
        callId,
        callerAvatar,
        callType,
        offer,
      });
    });

    // Call accepted
    this.socket.on("call-accepted", async (data) => {
      const { callId, acceptedBy, answer } = data;
      console.log(`✅ Call accepted by ${acceptedBy}`);

      try {
        await this.peerConnection.setRemoteDescription(
          new RTCSessionDescription(answer),
        );
        this.onCallStatusChange?.("connected");
      } catch (error) {
        console.error("Error setting remote description:", error);
        this.onError?.("Failed to establish connection");
        this.endCall();
      }
    });

    // Call rejected
    this.socket.on("call-rejected", (data) => {
      const { callId, rejectedBy, reason } = data;
      console.log(`❌ Call rejected by ${rejectedBy}: ${reason}`);
      this.onError?.(`Call declined: ${reason}`);
      this.cleanup();
      this.onCallStatusChange?.(null);
    });

    // Call ended
    this.socket.on("call-ended", (data) => {
      const { callId, endedBy, reason } = data;
      console.log(`🔚 Call ended by ${endedBy}`);
      this.cleanup();
      this.onCallStatusChange?.(null);
      this.onCallEnded?.(reason || `Call ended by ${endedBy}`);
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
      this.currentCallId = data.callId;
      this.onCallStatusChange?.("ringing");
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
  }

  async initiateCall(targetAvatar, callType = "audio") {
    console.log(`📞 Initiating ${callType} call to ${targetAvatar}`);

    this.callType = callType;
    this.isInitiator = true;

    try {
      await this.getUserMedia(callType);
      this.createPeerConnection(targetAvatar);

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === "video",
      });

      await this.peerConnection.setLocalDescription(offer);

      this.socket.emit("call-initiate", {
        targetAvatar,
        callType,
        offer: this.peerConnection.localDescription,
      });

      this.onCallStatusChange?.("calling");
    } catch (error) {
      console.error("Error initiating call:", error);
      this.onError?.(`Failed to start call: ${error.message}`);
      this.cleanup();
    }
  }

  async acceptCall(incomingCall) {
    const { callId, callerAvatar, callType, offer } = incomingCall;
    console.log(`✅ Accepting ${callType} call from ${callerAvatar}`);

    this.callType = callType;
    this.currentCallId = callId;

    try {
      await this.getUserMedia(callType);
      this.createPeerConnection(callerAvatar);

      await this.peerConnection.setRemoteDescription(
        new RTCSessionDescription(offer),
      );

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket.emit("call-accept", {
        callId,
        callerAvatar,
        answer: this.peerConnection.localDescription,
      });

      this.onCallStatusChange?.("connected");
    } catch (error) {
      console.error("Error accepting call:", error);
      this.onError?.(`Failed to accept call: ${error.message}`);
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

    this.cleanup();
  }

  endCall() {
    console.log("🔚 Ending call");

    if (this.socket && this.currentCallId) {
      this.socket.emit("call-end", {
        callId: this.currentCallId,
        targetAvatar: this.targetAvatar,
      });
    }

    this.cleanup();
    this.onCallStatusChange?.(null);
  }

  async getUserMedia(callType) {
    const constraints = {
      audio: true,
      video:
        callType === "video"
          ? {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 720 },
            }
          : false,
    };

    try {
      this.localStream = await mediaDevices.getUserMedia(constraints);
      this.onLocalStreamChange?.(this.localStream);
      return this.localStream;
    } catch (error) {
      console.error("Error getting user media:", error);
      throw new Error(
        "Could not access microphone/camera. Please check permissions.",
      );
    }
  }

  createPeerConnection(targetAvatar) {
    this.targetAvatar = targetAvatar;
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

    // Handle connection state changes with reconnection logic
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log("Connection state:", state);

      switch (state) {
        case "connected":
          this.reconnectAttempts = 0;
          this.startQualityMonitoring();
          this.onConnectionQualityChange?.("good");
          break;
        case "disconnected":
          this.onConnectionQualityChange?.("poor");
          this.handleConnectionRecovery(targetAvatar);
          break;
        case "failed":
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            this.onError?.(
              `Reconnecting... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
            );
            this.attemptReconnect(targetAvatar);
          } else {
            this.onError?.("Call connection failed");
            this.onConnectionQualityChange?.("disconnected");
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
          this.onCallStatusChange?.("connecting");
          break;
        case "connected":
        case "completed":
          this.onCallStatusChange?.("connected");
          break;
        case "disconnected":
          this.onError?.("Connection unstable");
          break;
      }
    };

    // Handle remote stream
    this.peerConnection.ontrack = (event) => {
      console.log("Received remote track:", event.track.kind);
      this.remoteStream = event.streams[0];
      this.onRemoteStreamChange?.(this.remoteStream);
    };

    return this.peerConnection;
  }

  toggleAudio() {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;

      this.socket?.emit("call-media-toggle", {
        targetAvatar: this.targetAvatar,
        callId: this.currentCallId,
        mediaType: "audio",
        enabled: audioTrack.enabled,
      });

      return audioTrack.enabled;
    }
    return false;
  }

  toggleVideo() {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;

      this.socket?.emit("call-media-toggle", {
        targetAvatar: this.targetAvatar,
        callId: this.currentCallId,
        mediaType: "video",
        enabled: videoTrack.enabled,
      });

      return videoTrack.enabled;
    }
    return false;
  }

  async switchCamera() {
    if (!this.localStream || this.callType !== "video") return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      try {
        await videoTrack._switchCamera();
      } catch (error) {
        console.error("Error switching camera:", error);
      }
    }
  }

  startQualityMonitoring() {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(async () => {
      if (!this.peerConnection) return;

      try {
        const stats = await this.peerConnection.getStats();
        let qualityScore = 100;

        stats.forEach((report) => {
          if (report.type === "inbound-rtp" && report.kind === "audio") {
            if (report.packetsLost && report.packetsReceived) {
              const lossRate =
                report.packetsLost /
                (report.packetsReceived + report.packetsLost);
              if (lossRate > 0.1) qualityScore -= 40;
              else if (lossRate > 0.05) qualityScore -= 20;
              else if (lossRate > 0.02) qualityScore -= 10;
            }
          }

          if (
            report.type === "candidate-pair" &&
            report.state === "succeeded"
          ) {
            if (report.currentRoundTripTime) {
              const rtt = report.currentRoundTripTime * 1000;
              if (rtt > 400) qualityScore -= 30;
              else if (rtt > 200) qualityScore -= 15;
              else if (rtt > 100) qualityScore -= 5;
            }
          }
        });

        let quality;
        if (qualityScore >= 80) quality = "excellent";
        else if (qualityScore >= 60) quality = "good";
        else if (qualityScore >= 40) quality = "fair";
        else quality = "poor";

        if (quality !== this.connectionQuality) {
          this.connectionQuality = quality;
          this.onConnectionQualityChange?.(quality);
        }
      } catch (error) {
        console.error("Error getting stats:", error);
      }
    }, 3000);
  }

  stopQualityMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  async handleConnectionRecovery(targetAvatar) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (this.peerConnection?.connectionState === "disconnected") {
      this.attemptReconnect(targetAvatar);
    }
  }

  async attemptReconnect(targetAvatar) {
    if (!this.peerConnection || !this.socket) return;

    try {
      console.log("🔄 Attempting ICE restart...");

      const offer = await this.peerConnection.createOffer({ iceRestart: true });
      await this.peerConnection.setLocalDescription(offer);

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

  cleanup() {
    this.stopQualityMonitoring();

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

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
    this.targetAvatar = null;

    this.onLocalStreamChange?.(null);
    this.onRemoteStreamChange?.(null);
    this.onConnectionQualityChange?.(null);
  }

  getConnectionQuality() {
    return this.connectionQuality;
  }
}

export const webrtcService = new WebRTCService();
export default webrtcService;
