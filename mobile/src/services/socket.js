import { io } from "socket.io-client";
import { useChatStore, useAuthStore, useUIStore } from "../store";
import cryptoService from "./crypto";

const SOCKET_URL = __DEV__
  ? "http://localhost:3000"
  : "https://your-production-url.com";

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect() {
    this.socket = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    this.setupListeners();
    useChatStore.getState().setSocket(this.socket);

    return this.socket;
  }

  setupListeners() {
    const {
      setConnected,
      addMessage,
      setCurrentSession,
      setTypingUser,
      updateMessageStatus,
      setIncomingCall,
      setCallStatus,
      setActiveCall,
    } = useChatStore.getState();
    const { showToast } = useUIStore.getState();

    this.socket.on("connect", () => {
      console.log("✅ Connected to server");
      setConnected(true);
      this.reconnectAttempts = 0;

      const user = useAuthStore.getState().user;
      if (user?.avatarName) {
        this.socket.emit("user-join", { avatarName: user.avatarName });
      }
    });

    this.socket.on("disconnect", (reason) => {
      console.log("❌ Disconnected:", reason);
      setConnected(false);
    });

    this.socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error.message);
      this.reconnectAttempts++;
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        showToast("Unable to connect to server", "error");
      }
    });

    // Session handling
    this.socket.on("session-request", (data) => {
      const sessionKey = cryptoService.generateSessionKey();

      this.socket.emit("session-accept", {
        targetAvatar: data.initiatorAvatar,
        sessionKey: sessionKey,
      });

      setCurrentSession({
        peerAvatar: data.initiatorAvatar,
        sessionKey: sessionKey,
        establishedAt: new Date(),
      });

      cryptoService.setSessionKey(sessionKey);
      showToast(`🔐 Secure session with ${data.initiatorAvatar}`, "success");
    });

    this.socket.on("session-established", (data) => {
      setCurrentSession({
        peerAvatar: data.peerAvatar,
        sessionKey: data.sessionKey,
        establishedAt: new Date(),
      });

      cryptoService.setSessionKey(data.sessionKey);
      showToast(`🔐 Secure session with ${data.peerAvatar}`, "success");
    });

    this.socket.on("session-error", (data) => {
      showToast(data.message, "error");
    });

    // Message handling
    this.socket.on("new-message", (data) => {
      const decrypted = cryptoService.decryptMessage(data.encryptedMessage);

      if (decrypted) {
        addMessage({
          message: decrypted,
          messageId: data.messageId,
          from: data.from,
          timestamp: new Date(data.timestamp),
          isSent: false,
          status: "delivered",
        });
      }
    });

    this.socket.on("message-read", (data) => {
      updateMessageStatus(data.messageId, "read");
    });

    // Typing indicators
    this.socket.on("user-typing", (data) => {
      setTypingUser(data.avatarName, data.isTyping);
    });

    // Call handling
    this.socket.on("call-incoming", (data) => {
      setIncomingCall({
        callId: data.callId,
        callerAvatar: data.callerAvatar,
        callType: data.callType,
        offer: data.offer,
      });
      showToast(
        `Incoming ${data.callType} call from ${data.callerAvatar}`,
        "info",
      );
    });

    this.socket.on("call-ringing", (data) => {
      setCallStatus("ringing");
    });

    this.socket.on("call-accepted", (data) => {
      setCallStatus("connected");
      showToast("Call connected!", "success");
    });

    this.socket.on("call-rejected", (data) => {
      setCallStatus(null);
      setActiveCall(null);
      showToast(`Call declined: ${data.reason}`, "error");
    });

    this.socket.on("call-ended", (data) => {
      setCallStatus(null);
      setActiveCall(null);
      showToast(`Call ended by ${data.endedBy}`, "info");
    });
  }

  joinUser(avatarName) {
    if (this.socket?.connected) {
      this.socket.emit("user-join", { avatarName });
    }
  }

  requestSession(targetAvatar, secretCode) {
    const user = useAuthStore.getState().user;

    if (!user?.avatarName) {
      useUIStore.getState().showToast("Please login first", "error");
      return;
    }

    if (!this.socket?.connected) {
      useUIStore.getState().showToast("Not connected to server", "error");
      return;
    }

    this.socket.emit("session-request", {
      targetAvatar,
      secretCode,
      initiatorAvatar: user.avatarName,
    });

    useUIStore
      .getState()
      .showToast(`Session request sent to ${targetAvatar}`, "info");
  }

  sendMessage(message) {
    const session = useChatStore.getState().currentSession;
    const user = useAuthStore.getState().user;

    if (!session) {
      useUIStore.getState().showToast("No active session", "error");
      return;
    }

    const encrypted = cryptoService.encryptMessage(message);
    const messageId = cryptoService.generateMessageId();

    useChatStore.getState().addMessage({
      message,
      messageId,
      from: user.avatarName,
      timestamp: new Date(),
      isSent: true,
      status: "sent",
    });

    this.socket.emit("send-message", {
      targetAvatar: session.peerAvatar,
      encryptedMessage: encrypted,
      messageId,
    });
  }

  startTyping() {
    const session = useChatStore.getState().currentSession;
    if (session && this.socket?.connected) {
      this.socket.emit("typing-start", { targetAvatar: session.peerAvatar });
    }
  }

  stopTyping() {
    const session = useChatStore.getState().currentSession;
    if (session && this.socket?.connected) {
      this.socket.emit("typing-stop", { targetAvatar: session.peerAvatar });
    }
  }

  // Call methods
  initiateCall(targetAvatar, callType, offer) {
    this.socket.emit("call-initiate", { targetAvatar, callType, offer });
    useChatStore.getState().setCallStatus("calling");
    useChatStore
      .getState()
      .setActiveCall({ targetAvatar, callType, isInitiator: true });
  }

  acceptCall(callId, callerAvatar, answer) {
    this.socket.emit("call-accept", { callId, callerAvatar, answer });
  }

  rejectCall(callId, callerAvatar, reason) {
    this.socket.emit("call-reject", { callId, callerAvatar, reason });
    useChatStore.getState().setIncomingCall(null);
  }

  endCall(callId, targetAvatar) {
    this.socket.emit("call-end", { callId, targetAvatar });
    useChatStore.getState().setCallStatus(null);
    useChatStore.getState().setActiveCall(null);
  }

  sendIceCandidate(targetAvatar, candidate, callId) {
    this.socket.emit("call-ice-candidate", { targetAvatar, candidate, callId });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    useChatStore.getState().setConnected(false);
  }
}

export const socketService = new SocketService();
export default socketService;
