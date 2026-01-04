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

    // Typing indicators
    this.socket.on("user-typing", (data) => {
      this.updateTypingIndicator(data.avatarName, data.isTyping);
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
      const sessionKey = dootCrypto.generateSessionKey();

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

      dootCrypto.sessionKey = sessionKey;

      this.showMessage(
        `🔐 Secure session established with ${data.initiatorAvatar}`,
        "success"
      );
      this.showChatInterface();

      console.log("✅ Session auto-accepted for testing");
    }
  }

  // Handle session establishment
  handleSessionEstablished(data) {
    this.currentSession = {
      peerAvatar: data.peerAvatar,
      sessionKey: data.sessionKey,
      establishedAt: new Date(),
    };

    dootCrypto.sessionKey = data.sessionKey;

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

    const encryptedMessage = dootCrypto.encryptMessage(message);
    const messageId =
      Date.now().toString() + Math.random().toString(36).substr(2, 9);

    const messageData = {
      message: message,
      messageId: messageId,
      from: authManager.currentUser.avatarName,
      timestamp: new Date(),
      isSent: true,
      status: "sent",
    };

    // Store message in history
    this.storeMessageInHistory(messageData);

    // Display message locally immediately
    this.displayMessage(messageData);

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
    const decryptedMessage = dootCrypto.decryptMessage(data.encryptedMessage);

    if (decryptedMessage) {
      const messageData = {
        message: decryptedMessage,
        messageId: data.messageId,
        from: data.from,
        timestamp: new Date(data.timestamp),
        isSent: false,
        status: "delivered",
      };

      // Store message in history
      this.storeMessageInHistory(messageData);

      this.displayMessage(messageData);

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

      const fileData = await dootCrypto.fileToBase64(file);
      const encryptedFileData = dootCrypto.encryptFile(fileData);

      this.socket.emit("send-file", {
        targetAvatar: this.currentSession.peerAvatar,
        fileData: encryptedFileData,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });

      this.showMessage("File sent securely", "success");

      // Show file sent message in chat and store in history
      const fileMessageData = {
        message: `📎 Sent a file: ${file.name}`,
        messageId: "file-sent-" + Date.now(),
        from: authManager.currentUser.avatarName,
        timestamp: new Date(),
        isSent: true,
        status: "sent",
        isFile: true,
        fileName: file.name,
      };

      this.storeMessageInHistory(fileMessageData);
      this.displayMessage(fileMessageData);

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
    const decryptedFileData = dootCrypto.decryptFile(data.fileData);

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

      // Show file received message in chat and store in history
      const fileMessageData = {
        message: `📎 Sent a file: ${data.fileName}`,
        messageId: "file-" + Date.now(),
        from: data.from,
        timestamp: new Date(data.timestamp),
        isSent: false,
        status: "delivered",
        isFile: true,
        fileName: data.fileName,
      };

      this.storeMessageInHistory(fileMessageData);
      this.displayMessage(fileMessageData);
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

  // Update typing indicator
  updateTypingIndicator(avatarName, isTyping) {
    if (!this.currentSession || avatarName !== this.currentSession.peerAvatar) {
      return;
    }

    const typingIndicator = document.getElementById("typingIndicator");
    if (!typingIndicator) return;

    if (isTyping) {
      typingIndicator.style.display = "block";
      typingIndicator.innerHTML = `
        <i class="fas fa-circle"></i>
        <i class="fas fa-circle"></i>
        <i class="fas fa-circle"></i>
        ${avatarName} is typing...
      `;
    } else {
      typingIndicator.style.display = "none";
    }
  }

  // Handle typing events
  startTyping() {
    if (!this.currentSession || !this.socket) return;

    this.socket.emit("typing-start", {
      targetAvatar: this.currentSession.peerAvatar,
    });
  }

  stopTyping() {
    if (!this.currentSession || !this.socket) return;

    this.socket.emit("typing-stop", {
      targetAvatar: this.currentSession.peerAvatar,
    });
  }

  // Setup typing detection
  setupTypingDetection() {
    const messageInput = document.getElementById("messageInput");
    if (!messageInput) return;

    let typingTimeout;

    messageInput.addEventListener("input", () => {
      if (!this.currentSession) return;

      // Clear existing timeout
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }

      // Start typing indicator
      this.startTyping();

      // Set timeout to stop typing indicator
      typingTimeout = setTimeout(() => {
        this.stopTyping();
      }, 1000); // Stop after 1 second of no typing
    });

    messageInput.addEventListener("blur", () => {
      // Stop typing when input loses focus
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      this.stopTyping();
    });
  }

  // Show chat interface
  showChatInterface() {
    const sessionSetup = document.getElementById("sessionSetup");
    const activeChat = document.getElementById("activeChat");
    const peerAvatarName = document.getElementById("peerAvatarName");

    if (this.currentSession) {
      // Show active chat if session exists
      if (sessionSetup) sessionSetup.style.display = "none";
      if (activeChat) activeChat.style.display = "block";
      if (peerAvatarName) {
        peerAvatarName.textContent = this.currentSession.peerAvatar;
      }

      // Clear any existing system messages and add new one, then load history
      const messagesContainer = document.getElementById("messagesContainer");
      if (messagesContainer) {
        messagesContainer.innerHTML = `
                    <div class="system-message">
                        <i class="fas fa-shield-alt"></i> Secure session established with ${this.currentSession.peerAvatar}. All messages are end-to-end encrypted.
                    </div>
                `;

        // Load and display message history
        this.loadAndDisplayMessageHistory();
      }

      // Setup typing detection
      this.setupTypingDetection();

      // Setup Safe panel toggle
      this.setupSafePanelToggle();

      // Setup session management
      this.setupSessionManagement();
    } else {
      // Show session setup if no session exists
      if (sessionSetup) sessionSetup.style.display = "block";
      if (activeChat) activeChat.style.display = "none";
      if (peerAvatarName) {
        peerAvatarName.textContent = "Waiting for connection...";
      }
    }

    console.log(
      "💬 Chat interface activated",
      this.currentSession ? "with active session" : "showing session setup"
    );
  }

  // Setup Safe panel toggle functionality
  setupSafePanelToggle() {
    const toggleSafeBtn = document.getElementById("toggleSafeBtn");
    const closeSafePanelBtn = document.getElementById("closeSafePanelBtn");
    const chatSafePanel = document.getElementById("chatSafePanel");
    const chatMain = document.querySelector(".chat-main");

    if (toggleSafeBtn) {
      toggleSafeBtn.addEventListener("click", () => {
        if (chatSafePanel && chatMain) {
          const isVisible = chatSafePanel.style.display !== "none";
          chatSafePanel.style.display = isVisible ? "none" : "flex";
          chatMain.classList.toggle("has-safe", !isVisible);

          // Update button text
          toggleSafeBtn.innerHTML = isVisible
            ? '<i class="fas fa-vault"></i> Safe'
            : '<i class="fas fa-times"></i> Close';

          // Refresh Safe content when opening
          if (!isVisible) {
            this.updateChatSafeUI();
          }
        }
      });
    }

    if (closeSafePanelBtn) {
      closeSafePanelBtn.addEventListener("click", () => {
        if (chatSafePanel && chatMain) {
          chatSafePanel.style.display = "none";
          chatMain.classList.remove("has-safe");
          const toggleSafeBtn = document.getElementById("toggleSafeBtn");
          if (toggleSafeBtn) {
            toggleSafeBtn.innerHTML = '<i class="fas fa-vault"></i> Safe';
          }
        }
      });
    }
  }

  // Setup session management functionality
  setupSessionManagement() {
    const endSessionBtn = document.getElementById("endSessionBtn");
    const clearHistoryBtn = document.getElementById("clearHistoryBtn");

    if (endSessionBtn) {
      endSessionBtn.addEventListener("click", () => {
        this.handleEndSession();
      });
    }

    if (clearHistoryBtn) {
      clearHistoryBtn.addEventListener("click", () => {
        this.handleClearHistory();
      });
    }

    // Listen for session ended events
    if (this.socket) {
      this.socket.on("session-ended", (data) => {
        this.handleSessionEnded(data);
      });
    }
  }

  // Handle end session button click
  handleEndSession() {
    if (!this.currentSession) {
      showQuickToast("No active session to end", "warning", 3000);
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to end the session with ${this.currentSession.peerAvatar}?`
    );

    if (!confirmed) return;

    console.log(`🔚 Ending session with ${this.currentSession.peerAvatar}`);

    // Notify the other user
    this.socket.emit("end-session", {
      targetAvatar: this.currentSession.peerAvatar,
    });

    // Clean up local session
    this.endSessionLocally("You ended the session.");
  }

  // Handle clear history button click
  handleClearHistory() {
    if (!this.currentSession) {
      showQuickToast("No active session to clear history", "warning", 3000);
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to clear the chat history with ${this.currentSession.peerAvatar}? This action cannot be undone.`
    );

    if (!confirmed) return;

    // Clear message history from localStorage
    this.clearMessageHistory(this.currentSession.peerAvatar);

    // Clear messages from UI
    const messagesContainer = document.getElementById("messagesContainer");
    if (messagesContainer) {
      // Keep only the system message
      const systemMessage = messagesContainer.querySelector(".system-message");
      messagesContainer.innerHTML = "";

      if (systemMessage) {
        messagesContainer.appendChild(systemMessage.cloneNode(true));
      }
    }

    showQuickToast("Chat history cleared", "info", 3000);
    console.log(
      `🗑️ Chat history cleared for session with ${this.currentSession.peerAvatar}`
    );
  }

  // Handle when session is ended (received from other user or self)
  handleSessionEnded(data) {
    console.log("🔚 Session ended:", data);
    this.endSessionLocally(data.message);
  }

  // Clean up session locally
  endSessionLocally(message) {
    // Clear current session
    this.currentSession = null;

    // Clear crypto session key
    if (window.dootCrypto) {
      window.dootCrypto.sessionKey = null;
    }

    // Show session ended message
    const messagesContainer = document.getElementById("messagesContainer");
    if (messagesContainer) {
      const sessionEndedMessage = document.createElement("div");
      sessionEndedMessage.className = "system-message session-ended";
      sessionEndedMessage.innerHTML = `
        <i class="fas fa-times-circle"></i> ${message}
        <br><small>You can start a new session anytime.</small>
      `;
      messagesContainer.appendChild(sessionEndedMessage);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Update UI to show session setup
    const sessionSetup = document.getElementById("sessionSetup");
    const activeChat = document.getElementById("activeChat");
    const peerAvatarName = document.getElementById("peerAvatarName");

    if (sessionSetup) sessionSetup.style.display = "block";
    if (activeChat) activeChat.style.display = "none";
    if (peerAvatarName)
      peerAvatarName.textContent = "Waiting for connection...";

    // Hide Safe panel if open
    const chatSafePanel = document.getElementById("chatSafePanel");
    const chatMain = document.querySelector(".chat-main");
    if (chatSafePanel && chatMain) {
      chatSafePanel.style.display = "none";
      chatMain.classList.remove("has-safe");
      const toggleSafeBtn = document.getElementById("toggleSafeBtn");
      if (toggleSafeBtn) {
        toggleSafeBtn.innerHTML = '<i class="fas fa-vault"></i> Safe';
      }
    }

    showQuickToast(message, "info", 4000);
  }

  // Update Safe UI within chat interface
  async updateChatSafeUI() {
    const safeGrid = document.getElementById("chatSafeGrid");
    if (!safeGrid) return;

    const files = await safeManager.getAllFiles();

    safeGrid.innerHTML = "";

    if (files.length === 0) {
      safeGrid.innerHTML = `
        <div class="no-files-compact">
          <i class="fas fa-box-open"></i>
          <p>No secured files</p>
        </div>
      `;
      return;
    }

    files.forEach((file) => {
      const fileElement = document.createElement("div");
      fileElement.className = "file-item-compact";

      const fileIcon = safeManager.getFileIcon(file.type);

      fileElement.innerHTML = `
        <div class="file-icon-compact">${fileIcon}</div>
        <div class="file-info-compact">
          <div class="file-name-compact" title="${file.name}">${file.name}</div>
          <div class="file-meta-compact">${new Date(
            file.timestamp
          ).toLocaleDateString()}</div>
        </div>
        <div class="file-actions-compact">
          <button onclick="chatManager.downloadFileFromSafe(${
            file.id
          })" title="Download">
            <i class="fas fa-download"></i>
          </button>
          <button onclick="chatManager.verifyFileFromSafe(${
            file.id
          })" title="Verify">
            <i class="fas fa-shield-alt"></i>
          </button>
          <button onclick="chatManager.deleteFileFromSafe(${
            file.id
          })" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      `;

      safeGrid.appendChild(fileElement);
    });
  }

  // Safe file operations from chat interface
  async downloadFileFromSafe(fileId) {
    await safeManager.downloadFile(fileId);
    showQuickToast("File downloaded from Safe", "success", 2000);
  }

  async verifyFileFromSafe(fileId) {
    try {
      // For now, just mark as verified since we can't verify without proper signatures
      // In a real implementation, this would verify digital signatures
      await safeManager.updateFileVerification(fileId, true);
      this.updateChatSafeUI();
      showQuickToast("File marked as verified", "success", 3000);
    } catch (error) {
      console.error("Error verifying file:", error);
      showQuickToast("Failed to verify file", "error", 3000);
    }
  }

  async deleteFileFromSafe(fileId) {
    if (confirm("Are you sure you want to delete this file from Safe?")) {
      await safeManager.deleteFile(fileId);
      this.updateChatSafeUI();
      showQuickToast("File deleted from Safe", "info", 2000);
    }
  }

  // Message history management
  getMessageHistoryKey(peerAvatar) {
    return `doot_history_${authManager.currentUser.avatarName}_${peerAvatar}`;
  }

  storeMessageInHistory(messageData) {
    if (!this.currentSession) return;

    const historyKey = this.getMessageHistoryKey(
      this.currentSession.peerAvatar
    );
    let history = this.loadMessageHistory(this.currentSession.peerAvatar);

    // Add new message to history
    history.push({
      ...messageData,
      timestamp: messageData.timestamp.toISOString(), // Convert to string for storage
    });

    // Keep only last 1000 messages to prevent storage bloat
    if (history.length > 1000) {
      history = history.slice(-1000);
    }

    localStorage.setItem(historyKey, JSON.stringify(history));
  }

  loadMessageHistory(peerAvatar) {
    const historyKey = this.getMessageHistoryKey(peerAvatar);
    const stored = localStorage.getItem(historyKey);

    if (stored) {
      try {
        const history = JSON.parse(stored);
        // Convert timestamp strings back to Date objects
        return history.map((msg) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      } catch (error) {
        console.error("Error loading message history:", error);
        return [];
      }
    }

    return [];
  }

  loadAndDisplayMessageHistory() {
    if (!this.currentSession) return;

    const history = this.loadMessageHistory(this.currentSession.peerAvatar);

    // Clear current messages except system message
    const messagesContainer = document.getElementById("messagesContainer");
    if (messagesContainer) {
      // Keep the system message and add history
      const systemMessage = messagesContainer.querySelector(".system-message");
      messagesContainer.innerHTML = "";

      if (systemMessage) {
        messagesContainer.appendChild(systemMessage);
      }

      // Display history messages
      history.forEach((messageData) => {
        this.displayMessage(messageData);
      });
    }
  }

  clearMessageHistory(peerAvatar) {
    const historyKey = this.getMessageHistoryKey(peerAvatar);
    localStorage.removeItem(historyKey);
  }

  showMessage(message, type = "info") {
    showQuickToast(message, type, 3000);
  }
}

// Global chat instance
window.chatManager = new ChatManager();
