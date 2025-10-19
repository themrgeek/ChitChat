// UI Management
class AppManager {
  constructor() {
    this.currentView = "auth";
    this.currentUser = null;
    this.currentEmail = null;
    this.initializeApp();
  }

  initializeApp() {
    this.setupEventListeners();
    this.showEmailAuth();
    console.log("🚀 ChitChat App Initialized");
  }

  // Setup global event listeners
  setupEventListeners() {
    // Email auth form
    document.getElementById("sendOTPBtn")?.addEventListener("click", () => {
      this.handleSendOTP();
    });

    // OTP verification form
    document.getElementById("verifyOTPBtn")?.addEventListener("click", () => {
      this.handleVerifyOTP();
    });

    // Avatar login form
    document.getElementById("avatarLoginBtn")?.addEventListener("click", () => {
      this.handleAvatarLogin();
    });

    // Session request
    document
      .getElementById("requestSessionBtn")
      ?.addEventListener("click", () => {
        const targetAvatar = document.getElementById("targetAvatarInput").value;
        const secretCode = document.getElementById("secretCodeInput").value;
        if (targetAvatar && secretCode) {
          chatManager.requestSession(targetAvatar, secretCode);
        }
      });

    // Send message
    document.getElementById("sendMessageBtn")?.addEventListener("click", () => {
      const messageInput = document.getElementById("messageInput");
      const message = messageInput.value.trim();
      if (message) {
        chatManager.sendMessage(message);
        messageInput.value = "";
      }
    });

    // File upload
    document.getElementById("fileInput")?.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        chatManager.sendFile(file);
      }
    });

    // Navigation
    document
      .getElementById("navChat")
      ?.addEventListener("click", () => this.showChatInterface());
    document
      .getElementById("navSafe")
      ?.addEventListener("click", () => this.showSafeFolder());
    document
      .getElementById("navLogout")
      ?.addEventListener("click", () => this.handleLogout());

    // Enter key for messages
    document
      .getElementById("messageInput")
      ?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          document.getElementById("sendMessageBtn").click();
        }
      });

    // Enter key for OTP input
    document.getElementById("otpInput")?.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        this.handleVerifyOTP();
      }
    });

    // Enter key for password input
    document
      .getElementById("avatarPasswordInput")
      ?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.handleAvatarLogin();
        }
      });
  }

  // Handle OTP sending
  async handleSendOTP() {
    const email = document.getElementById("emailInput").value.trim();

    if (!email) {
      this.showMessage("Please enter your email", "error");
      return;
    }

    this.showLoading("Sending OTP to secure channel...");

    try {
      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        this.showMessage(
          "OTP sent successfully! Check your console for details.",
          "success"
        );
        this.showOTPVerification();
        // Store email for verification
        this.currentEmail = email;
        // For demo, auto-fill OTP from response
        if (data.otp) {
          document.getElementById("otpInput").value = data.otp;
        }
      } else {
        throw new Error(data.error || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      this.showMessage("Failed to send OTP: " + error.message, "error");
    } finally {
      this.hideLoading();
    }
  }

  // Handle OTP verification
  async handleVerifyOTP() {
    const otp = document.getElementById("otpInput").value.trim();

    if (!otp) {
      this.showMessage("Please enter the OTP", "error");
      return;
    }

    if (!this.currentEmail) {
      this.showMessage("Email not found. Please start over.", "error");
      return;
    }

    this.showLoading("Verifying OTP...");

    try {
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: this.currentEmail,
          otp: otp,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        this.showMessage(
          "OTP verified! Your secure identity has been created.",
          "success"
        );

        // Store user data
        this.currentUser = {
          avatarName: data.avatarName,
          password: data.password,
          privateKey: data.privateKey,
        };

        // Update UI with username
        this.updateUserInterface();

        // Auto-fill login form
        document.getElementById("avatarNameInput").value = data.avatarName;
        document.getElementById("avatarPasswordInput").value = data.password;

        this.showAvatarLogin();
      } else {
        throw new Error(data.error || "Invalid OTP");
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      this.showMessage("OTP verification failed: " + error.message, "error");
    } finally {
      this.hideLoading();
    }
  }

  // Handle avatar login
  async handleAvatarLogin(avatarName, password) {
    const avatarNameInput = document
      .getElementById("avatarNameInput")
      .value.trim();
    const passwordInput = document.getElementById("avatarPasswordInput").value;

    if (!avatarNameInput || !passwordInput) {
      this.showMessage("Please enter both avatar name and password", "error");
      return;
    }

    this.showLoading("Authenticating...");

    try {
      const result = await authManager.avatarLogin(
        avatarNameInput,
        passwordInput
      );
      if (result) {
        this.showMessage(
          "Secure login successful! Welcome, " + avatarNameInput,
          "success"
        );

        // Update current user in app manager
        this.currentUser = {
          avatarName: result.avatarName,
          publicKey: result.publicKey,
        };

        // Update the UI with the actual username
        this.updateUserInterface();

        // Initialize socket connection for chat
        chatManager.initializeSocket();

        this.showMainInterface();
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showMessage("Login failed: " + error.message, "error");
    } finally {
      this.hideLoading();
    }
  }

  // Update UI with current user information
  updateUserInterface() {
    if (this.currentUser && this.currentUser.avatarName) {
      // Update current avatar display
      const currentAvatarElement = document.getElementById("currentAvatar");
      if (currentAvatarElement) {
        currentAvatarElement.textContent = this.currentUser.avatarName;
        console.log("✅ Updated username to:", this.currentUser.avatarName);
      }
    }
  }

  // View management methods
  showEmailAuth() {
    this.showView("authView");
    document.getElementById("emailAuth").style.display = "block";
    document.getElementById("otpVerification").style.display = "none";
    document.getElementById("avatarLogin").style.display = "none";
  }

  showOTPVerification() {
    document.getElementById("emailAuth").style.display = "none";
    document.getElementById("otpVerification").style.display = "block";
    document.getElementById("avatarLogin").style.display = "none";
  }

  showAvatarLogin() {
    this.showView("authView");
    document.getElementById("emailAuth").style.display = "none";
    document.getElementById("otpVerification").style.display = "none";
    document.getElementById("avatarLogin").style.display = "block";
  }

  showMainInterface() {
    this.showView("mainView");
    this.updateUserInterface(); // Ensure username is updated
    this.showChatInterface();
  }

  showChatInterface() {
    document.getElementById("chatContainer").style.display = "block";
    document.getElementById("safeContainer").style.display = "none";
    this.updateActiveNav("navChat");
  }

  showSafeFolder() {
    document.getElementById("chatContainer").style.display = "none";
    document.getElementById("safeContainer").style.display = "block";
    safeManager.updateSafeUI();
    this.updateActiveNav("navSafe");
  }

  showView(viewId) {
    // Hide all views
    document.querySelectorAll(".view").forEach((view) => {
      view.style.display = "none";
    });

    // Show target view
    document.getElementById(viewId).style.display = "block";
    this.currentView = viewId;
  }

  updateActiveNav(activeNavId) {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.getElementById(activeNavId)?.classList.add("active");
  }

  showLoading(message) {
    console.log("Loading:", message);
    // Use the button loading utility
    if (event?.target) {
      showButtonLoading(event.target, message);
    }
    showQuickToast(message, "info", 2000);
  }

  hideLoading() {
    // Re-enable all buttons
    document.querySelectorAll("button").forEach((btn) => {
      if (btn.classList.contains("button-loading")) {
        hideButtonLoading(btn);
      }
    });
  }

  showMessage(message, type = "info") {
    showQuickToast(message, type, 5000);
  }

  handleLogout() {
    this.currentUser = null;
    this.currentEmail = null;
    authManager.logout();
    if (chatManager.socket) {
      chatManager.socket.disconnect();
    }
    this.showEmailAuth();
    this.showMessage("Secure logout completed.", "info");
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.appManager = new AppManager();
});
