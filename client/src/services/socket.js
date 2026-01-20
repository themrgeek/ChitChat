import { io } from "socket.io-client";
import { useChatStore, useAuthStore, useUIStore } from "../store";
import cryptoService from "./crypto";

class SocketService {
  constructor() {
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
  }

  connect() {
    const socketUrl = window.location.origin;

    this.socket = io(socketUrl, {
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
    } = useChatStore.getState();
    const { showToast } = useUIStore.getState();

    this.socket.on("connect", () => {
      console.log("✅ Connected to secure server");
      setConnected(true);
      this.reconnectAttempts = 0;

      // Re-register user on connect
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
        showToast(
          "Unable to connect to server. Please refresh the page.",
          "error",
        );
      }
    });

    this.socket.on("reconnect", (attemptNumber) => {
      console.log(`🔄 Reconnected after ${attemptNumber} attempts`);
      const user = useAuthStore.getState().user;
      if (user?.avatarName) {
        this.socket.emit("user-join", { avatarName: user.avatarName });
      }
    });

    // Session handling
    this.socket.on("session-request", (data) => {
      console.log("📨 Session request from:", data.initiatorAvatar);

      // Auto-accept for now (can add confirmation modal later)
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
      useUIStore.getState().setView("chat");
    });

    this.socket.on("session-established", (data) => {
      console.log("✅ Session established with:", data.peerAvatar);

      setCurrentSession({
        peerAvatar: data.peerAvatar,
        sessionKey: data.sessionKey,
        establishedAt: new Date(),
      });

      cryptoService.setSessionKey(data.sessionKey);
      showToast(`🔐 Secure session with ${data.peerAvatar}`, "success");
      useUIStore.getState().setView("chat");
    });

    this.socket.on("session-error", (data) => {
      console.error("❌ Session error:", data.message);
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
      } else {
        console.error("Failed to decrypt message");
      }
    });

    this.socket.on("message-read", (data) => {
      updateMessageStatus(data.messageId, "read");
    });

    // Typing indicators
    this.socket.on("user-typing", (data) => {
      setTypingUser(data.avatarName, data.isTyping);
    });

    // User status
    this.socket.on("user-online", (data) => {
      useChatStore.getState().updateContactStatus(data.avatarName, true);
    });

    this.socket.on("user-offline", (data) => {
      useChatStore.getState().updateContactStatus(data.avatarName, false);
    });

    // File handling
    this.socket.on("file-received", (data) => {
      const decryptedFileData = cryptoService.decryptFile(data.fileData);

      if (decryptedFileData) {
        addMessage({
          message: `📎 File: ${data.fileName}`,
          messageId: "file-" + Date.now(),
          from: data.from,
          timestamp: new Date(data.timestamp),
          isSent: false,
          status: "delivered",
          isFile: true,
          fileName: data.fileName,
          fileType: data.fileType,
          fileData: decryptedFileData,
        });
        showToast(`File received from ${data.from}`, "success");
      }
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

    // Add to local messages
    useChatStore.getState().addMessage({
      message,
      messageId,
      from: user.avatarName,
      timestamp: new Date(),
      isSent: true,
      status: "sent",
    });

    // Send to peer
    this.socket.emit("send-message", {
      targetAvatar: session.peerAvatar,
      encryptedMessage: encrypted,
      messageId,
    });
  }

  async sendFile(file) {
    const session = useChatStore.getState().currentSession;
    const user = useAuthStore.getState().user;

    if (!session) {
      useUIStore.getState().showToast("No active session", "error");
      return;
    }

    try {
      const fileData = await cryptoService.fileToBase64(file);
      const encryptedFileData = cryptoService.encryptFile(fileData);

      this.socket.emit("send-file", {
        targetAvatar: session.peerAvatar,
        fileData: encryptedFileData,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      // Add to local messages
      useChatStore.getState().addMessage({
        message: `📎 Sent: ${file.name}`,
        messageId: "file-sent-" + Date.now(),
        from: user.avatarName,
        timestamp: new Date(),
        isSent: true,
        status: "sent",
        isFile: true,
        fileName: file.name,
      });

      useUIStore.getState().showToast("File sent", "success");
    } catch (error) {
      console.error("File send error:", error);
      useUIStore.getState().showToast("Failed to send file", "error");
    }
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
