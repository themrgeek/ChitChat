class ChatManager {
  constructor() {
    this.socket = null;
    this.currentSession = null;
    this.contacts = new Map();
  }

  // Initialize socket connection
  initializeSocket() {
    this.socket = io();

    this.socket.on("connect", () => {
      console.log("✅ Connected to secure server");

      // Register user with server
      if (authManager.currentUser && authManager.currentUser.avatarName) {
        this.socket.emit("user-join", {
          avatarName: authManager.currentUser.avatarName,
        });
      }
    });

    this.setupSocketListeners();
  }

  // Setup socket event listeners
  setupSocketListeners() {
    // Session request
    this.socket.on("session-request", (data) => {
      this.handleSessionRequest(data);
    });

    // Session established
    this.socket.on("session-established", (data) => {
      this.handleSessionEstablished(data);
    });

    // New message
    this.socket.on("new-message", (data) => {
      this.handleNewMessage(data);
    });

    // File received
    this.socket.on("file-received", (data) => {
      this.handleFileReceived(data);
    });

    // User online status
    this.socket.on("user-online", (data) => {
      this.updateUserStatus(data.avatarName, true);
    });

    this.socket.on("user-offline", (data) => {
      this.updateUserStatus(data.avatarName, false);
    });

    // Message read receipt
    this.socket.on("message-read", (data) => {
      this.updateMessageStatus(data.messageId, "read");
    });

    // Session error
    this.socket.on("session-error", (data) => {
      this.showMessage(`Session error: ${data.message}`, "error");
    });
  }

  // Request session with another user
  // In the requestSession method - improve the check:
  requestSession(targetAvatar, secretCode) {
    // Check if user is properly logged in
    if (!authManager.isLoggedIn()) {
      this.showMessage(
        "Please login first before starting a chat session",
        "error"
      );
      console.error(
        "❌ User not logged in. authManager.currentUser:",
        authManager.currentUser
      );
      return;
    }

    if (!this.socket) {
      this.showMessage("Not connected to server. Please try again.", "error");
      return;
    }

    if (!targetAvatar || !secretCode) {
      this.showMessage(
        "Please enter both avatar name and secret code",
        "error"
      );
      return;
    }

    console.log("🔄 Requesting session with:", targetAvatar);
    console.log("👤 Current user:", authManager.currentUser);

    this.socket.emit("session-request", {
      targetAvatar: targetAvatar,
      secretCode: secretCode,
      initiatorAvatar: authManager.currentUser.avatarName,
    });

    this.showMessage(`Session request sent to ${targetAvatar}`, "info");
  }
  // Handle incoming session request
  handleSessionRequest(data) {
    console.log("📨 Session request received from:", data.initiatorAvatar);

    // AUTO-ACCEPT for localhost testing - remove confirm()
    const accept = true; // Always accept for testing

    if (accept) {
      const sessionKey = chitChatCrypto.generateSessionKey();

      this.socket.emit("session-accept", {
        targetAvatar: data.initiatorAvatar,
        sessionKey: sessionKey,
      });

      // Store session locally immediately
      this.currentSession = {
        peerAvatar: data.initiatorAvatar,
        sessionKey: sessionKey,
        establishedAt: new Date(),
      };

      chitChatCrypto.sessionKey = sessionKey;

      this.showMessage(
        `🔐 Secure session established with ${data.initiatorAvatar}`,
        "success"
      );
      this.showChatInterface();

      console.log("✅ Session auto-accepted for testing");
    }
    // const accept = confirm(
    //   `Session request from ${data.initiatorAvatar}\n` +
    //     `Secret Code: ${data.secretCode}\n\n` +
    //     `Accept session?`
    // );

    // if (accept) {
    //   const sessionKey = chitChatCrypto.generateSessionKey();

    //   this.socket.emit("session-accept", {
    //     targetAvatar: data.initiatorAvatar,
    //     sessionKey: sessionKey,
    //   });

    //   // Store session locally immediately
    //   this.currentSession = {
    //     peerAvatar: data.initiatorAvatar,
    //     sessionKey: sessionKey,
    //     establishedAt: new Date(),
    //   };

    //   chitChatCrypto.sessionKey = sessionKey;

    //   this.showMessage(
    //     `Secure session established with ${data.initiatorAvatar}`,
    //     "success"
    //   );
    //   this.showChatInterface();
    // } else {
    //   this.showMessage("Session request declined", "info");
    // }
  }

  // Handle session establishment
  handleSessionEstablished(data) {
    this.currentSession = {
      peerAvatar: data.peerAvatar,
      sessionKey: data.sessionKey,
      establishedAt: new Date(),
    };

    chitChatCrypto.sessionKey = data.sessionKey;

    console.log("✅ Session established with:", data.peerAvatar);
    this.showMessage(
      `Secure session established with ${data.peerAvatar}`,
      "success"
    );
    this.showChatInterface();
  }

  // Send encrypted message
  sendMessage(message) {
    if (!this.currentSession) {
      this.showMessage("No active session", "error");
      return;
    }

    if (!this.socket) {
      this.showMessage("Not connected to server", "error");
      return;
    }

    const encryptedMessage = chitChatCrypto.encryptMessage(message);
    const messageId =
      Date.now().toString() + Math.random().toString(36).substr(2, 9);

    // Display message locally immediately
    this.displayMessage({
      message: message,
      messageId: messageId,
      from: authManager.currentUser.avatarName,
      timestamp: new Date(),
      isSent: true,
      status: "sent",
    });

    // Send to peer
    this.socket.emit("send-message", {
      targetAvatar: this.currentSession.peerAvatar,
      encryptedMessage: encryptedMessage,
      messageId: messageId,
    });

    console.log("💬 Message sent:", message);
  }

  // Handle incoming message
  handleNewMessage(data) {
    const decryptedMessage = chitChatCrypto.decryptMessage(
      data.encryptedMessage
    );

    if (decryptedMessage) {
      this.displayMessage({
        message: decryptedMessage,
        messageId: data.messageId,
        from: data.from,
        timestamp: new Date(data.timestamp),
        isSent: false,
        status: "delivered",
      });

      console.log("💬 Message received:", decryptedMessage);
    } else {
      console.error("❌ Failed to decrypt message");
    }
  }

  // Send file
  async sendFile(file) {
    if (!this.currentSession) {
      this.showMessage("No active session", "error");
      return;
    }

    try {
      this.showMessage("Encrypting and sending file...", "info");

      const fileData = await chitChatCrypto.fileToBase64(file);
      const encryptedFileData = chitChatCrypto.encryptFile(fileData);

      this.socket.emit("send-file", {
        targetAvatar: this.currentSession.peerAvatar,
        fileData: encryptedFileData,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      this.showMessage("File sent securely", "success");

      // Auto-save sent files to safe
      safeManager.saveFile({
        name: file.name,
        type: file.type,
        size: file.size,
        data: fileData,
        from: authManager.currentUser.avatarName,
        verified: true,
      });
    } catch (error) {
      console.error("❌ File send error:", error);
      this.showMessage("Failed to send file", "error");
    }
  }

  // Handle received file
  handleFileReceived(data) {
    const decryptedFileData = chitChatCrypto.decryptFile(data.fileData);

    if (decryptedFileData) {
      // Save to safe folder
      safeManager.saveFile({
        name: data.fileName,
        type: data.fileType,
        size: data.fileSize,
        data: decryptedFileData,
        from: data.from,
        timestamp: data.timestamp,
        verified: true,
      });

      this.showMessage(
        `File received from ${data.from} and saved to SAFE`,
        "success"
      );

      // Show file received message in chat
      this.displayMessage({
        message: `📎 Sent a file: ${data.fileName}`,
        messageId: "file-" + Date.now(),
        from: data.from,
        timestamp: new Date(data.timestamp),
        isSent: false,
        status: "delivered",
        isFile: true,
        fileName: data.fileName,
      });
    } else {
      this.showMessage("Failed to decrypt received file", "error");
    }
  }

  // Display message in chat
  displayMessage(messageData) {
    const messagesContainer = document.getElementById("messagesContainer");
    if (!messagesContainer) return;

    const messageElement = document.createElement("div");

    messageElement.className = `message ${
      messageData.isSent ? "sent" : "received"
    }`;

    if (messageData.isFile) {
      messageElement.innerHTML = `
                <div class="message-sender">${messageData.from}</div>
                <div class="message-content file-message">
                    <i class="fas fa-paperclip"></i> ${messageData.fileName}
                    <button onclick="safeManager.downloadFileByIndex(${
                      messageData.messageId
                    })" class="download-btn">
                        <i class="fas fa-download"></i> Download
                    </button>
                </div>
                <div class="message-time">${new Date(
                  messageData.timestamp
                ).toLocaleTimeString()}</div>
                ${
                  messageData.isSent
                    ? `<div class="message-status">${
                        messageData.status === "read" ? "✓✓" : "✓"
                      }</div>`
                    : ""
                }
            `;
    } else {
      messageElement.innerHTML = `
                <div class="message-sender">${messageData.from}</div>
                <div class="message-content">${messageData.message}</div>
                <div class="message-time">${new Date(
                  messageData.timestamp
                ).toLocaleTimeString()}</div>
                ${
                  messageData.isSent
                    ? `<div class="message-status">${
                        messageData.status === "read" ? "✓✓" : "✓"
                      }</div>`
                    : ""
                }
            `;
    }

    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Update message status
  updateMessageStatus(messageId, status) {
    // Find message and update status
    const messages = document.querySelectorAll(".message");
    messages.forEach((msg) => {
      if (
        msg.querySelector(".message-status") &&
        msg.textContent.includes(messageId)
      ) {
        const statusEl = msg.querySelector(".message-status");
        statusEl.textContent = status === "read" ? "✓✓" : "✓";
      }
    });
  }

  // Update user online status
  updateUserStatus(avatarName, isOnline) {
    // Update contacts list if implemented
    console.log(`👤 ${avatarName} is now ${isOnline ? "online" : "offline"}`);
  }

  // Show chat interface
  showChatInterface() {
    const sessionSetup = document.getElementById("sessionSetup");
    const activeChat = document.getElementById("activeChat");
    const peerAvatarName = document.getElementById("peerAvatarName");

    if (sessionSetup) sessionSetup.style.display = "none";
    if (activeChat) activeChat.style.display = "block";
    if (peerAvatarName && this.currentSession) {
      peerAvatarName.textContent = this.currentSession.peerAvatar;
    }

    // Clear any existing system messages and add new one
    const messagesContainer = document.getElementById("messagesContainer");
    if (messagesContainer) {
      messagesContainer.innerHTML = `
                <div class="system-message">
                    <i class="fas fa-shield-alt"></i> Secure session established with ${this.currentSession.peerAvatar}. All messages are end-to-end encrypted.
                </div>
            `;
    }

    console.log("💬 Chat interface activated");
  }

  showMessage(message, type = "info") {
    showQuickToast(message, type, 3000);
  }
}

// Global chat instance
window.chatManager = new ChatManager();
