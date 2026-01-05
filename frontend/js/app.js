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
    this.checkTermsAcceptance();
    console.log("🚀 ChitChat App Initialized");
  }

  // Terms modal methods
  checkTermsAcceptance() {
    const termsAccepted = localStorage.getItem("doot_terms_accepted");
    if (!termsAccepted) {
      this.showTermsModal();
    } else {
      this.showUserTypeSelection();
    }
  }

  showTermsModal() {
    const modal = document.getElementById("termsModal");
    if (modal) {
      modal.style.display = "flex";
    }
  }

  hideTermsModal() {
    const modal = document.getElementById("termsModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  handleTermsCheckbox(checked) {
    const acceptBtn = document.getElementById("acceptTermsBtn");
    if (acceptBtn) {
      acceptBtn.disabled = !checked;
    }
  }

  acceptTerms() {
    localStorage.setItem("doot_terms_accepted", "true");
    localStorage.setItem("doot_terms_accepted_date", new Date().toISOString());
    this.hideTermsModal();
    this.showUserTypeSelection();
    showQuickToast("Terms accepted. Welcome to ChitChat!", "success");
  }

  declineTerms() {
    showQuickToast("You must accept the terms to use ChitChat.", "error");
    // Optionally redirect or disable functionality
  }

  // Setup global event listeners
  setupEventListeners() {
    // Terms modal
    document.getElementById("termsAcceptance")?.addEventListener("change", (e) => {
      this.handleTermsCheckbox(e.target.checked);
    });
    document.getElementById("acceptTermsBtn")?.addEventListener("click", () => {
      this.acceptTerms();
    });
    document.getElementById("declineTermsBtn")?.addEventListener("click", () => {
      this.declineTerms();
    });

    // User type selection
    document.getElementById("newUserBtn")?.addEventListener("click", (event) => {
      this.handleNewUser(event);
    });
    document
      .getElementById("existingUserBtn")
      ?.addEventListener("click", () => {
        this.showAvatarLogin();
      });

    // New user setup
    document
      .getElementById("continueToLoginBtn")
      ?.addEventListener("click", () => {
        this.showAvatarLogin();
      });

    // Avatar login form
    document.getElementById("avatarLoginBtn")?.addEventListener("click", () => {
      this.handleAvatarLogin();
    });

    // Login OTP verification
    document
      .getElementById("verifyLoginOTPBtn")
      ?.addEventListener("click", () => {
        this.handleVerifyLoginOTP();
      });

    // Post-login options
    document.getElementById("chatOptionBtn")?.addEventListener("click", () => {
      this.showChatInterface();
    });
    document.getElementById("audioOptionBtn")?.addEventListener("click", () => {
      this.showMessage("Audio calls coming soon!", "info");
    });
    document.getElementById("videoOptionBtn")?.addEventListener("click", () => {
      this.showMessage("Video calls coming soon!", "info");
    });

    // Legacy email auth form
    document.getElementById("sendOTPBtn")?.addEventListener("click", () => {
      this.handleSendOTP();
    });

    // Legacy OTP verification form
    document.getElementById("verifyOTPBtn")?.addEventListener("click", () => {
      this.handleVerifyOTP();
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
      .getElementById("navSettings")
      ?.addEventListener("click", () => this.showSettings());
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

    // Enter key for login OTP
    document
      .getElementById("loginOTPInput")
      ?.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          this.handleVerifyLoginOTP();
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

  // Handle new user creation
  async handleNewUser(event) {
    const button = event?.target;
    this.showLoading("Creating your secure identity...", button);

    try {
      const response = await fetch("/api/auth/create-new-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (response.ok) {
        const emailMessage = data.emailStatus === 'queued'
          ? `Identity created! Use the credentials below to login. Email will be sent in ${data.estimatedEmailDelivery}.`
          : "Secure identity created! Use the credentials below to login.";

        this.showMessage(emailMessage, "success");

        // Store email status for potential status checking
        if (data.avatarName) {
          this.currentEmailStatus = {
            avatarName: data.avatarName,
            status: data.emailStatus,
            estimatedDelivery: data.estimatedEmailDelivery
          };
        }

        this.showNewUserSetup(data);
      } else {
        throw new Error(data.error || "Failed to create new user");
      }
    } catch (error) {
      console.error("New user creation error:", error);
      this.showMessage("Failed to create identity: " + error.message, "error");
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
          "Credentials verified! Sending OTP to your Ethereal email.",
          "success"
        );

        // Store user data temporarily
        this.tempUserData = {
          avatarName: result.avatarName,
          publicKey: result.publicKey,
        };

        // Show OTP verification for login
        this.showLoginOTPVerification();
      }
    } catch (error) {
      console.error("Login error:", error);
      this.showMessage("Login failed: " + error.message, "error");
    } finally {
      this.hideLoading();
    }
  }

  // Handle login OTP verification
  async handleVerifyLoginOTP() {
    const otp = document.getElementById("loginOTPInput").value.trim();

    if (!otp) {
      this.showMessage("Please enter the OTP", "error");
      return;
    }

    if (!this.currentEthrealEmail) {
      this.showMessage("Email not found. Please start over.", "error");
      return;
    }

    if (!this.tempUserData || !this.tempUserData.avatarName) {
      this.showMessage("User data not found. Please start over.", "error");
      return;
    }

    console.log("🔐 Verifying login OTP:", {
      email: this.currentEthrealEmail,
      avatarName: this.tempUserData.avatarName,
      otp: otp,
    });

    this.showLoading("Verifying OTP...");

    try {
      const response = await fetch("/api/auth/verify-login-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: this.currentEthrealEmail,
          avatarName: this.tempUserData.avatarName,
          otp: otp,
        }),
      });

      const data = await response.json();
      console.log("OTP verification response:", response.status, data);

      if (response.ok) {
        this.showMessage(
          "Secure login successful! Welcome, " + this.tempUserData.avatarName,
          "success"
        );

        // Update current user in app manager
        this.currentUser = {
          avatarName: this.tempUserData.avatarName,
          publicKey: this.tempUserData.publicKey,
        };

        // Update the UI with the actual username
        this.updateUserInterface();

        // Initialize socket connection for chat
        chatManager.initializeSocket();

        this.showPostLoginOptions();
      } else {
        throw new Error(data.error || "Invalid OTP");
      }
    } catch (error) {
      console.error("Verify login OTP error:", error);
      this.showMessage("OTP verification failed: " + error.message, "error");
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
  showUserTypeSelection() {
    this.showView("authView");
    const elements = [
      "userTypeSelection",
      "newUserSetup",
      "avatarLogin",
      "loginOTPVerification",
      "emailAuth",
      "otpVerification",
    ];
    elements.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === "userTypeSelection" ? "block" : "none";
    });
  }

  showNewUserSetup(data) {
    try {
      console.log("🎨 Setting up new user display with data:", data);

      // Ensure any loading states are cleared
      this.hideLoading();

      const elements = [
        "userTypeSelection",
        "newUserSetup",
        "avatarLogin",
        "loginOTPVerification",
      ];
      elements.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.style.display = id === "newUserSetup" ? "block" : "none";
      });

      // Update the content with user data
      const content = document.getElementById("newUserContent");
      if (data && data.avatarName) {
      content.innerHTML = `
        <div class="credentials" style="text-align: center;">
          <h3>🕵️ Your Secure Identity Created!</h3>
          <p><strong>Avatar Name:</strong> ${data.avatarName}</p>
          <p><strong>Temporary Password:</strong> ${data.password}</p>
          <p><strong>Ethereal Email:</strong> ${data.etherealEmail}</p>
          ${
            data.etherealPassword
              ? `<p><strong>Ethereal Password:</strong> ${data.etherealPassword}</p>`
              : ""
          }
          <div style="background: rgba(255, 165, 0, 0.1); border: 1px solid #ffaa00; padding: 10px; border-radius: 5px; margin: 15px 0;">
            <p style="font-size: 12px; color: #ffaa00; margin: 0;">
              <i class="fas fa-exclamation-triangle"></i> <strong>Security Note:</strong> Keep these credentials secure and do not share them.
            </p>
          </div>
          <p style="font-size: 12px; color: var(--secondary-color); margin-top: 15px;">
            ${
              data.emailStatus === 'queued'
                ? `<i class="fas fa-clock"></i> Email is being sent in the background (${data.estimatedEmailDelivery}).<br>`
                : '<i class="fas fa-info-circle"></i> Your credentials have been emailed to the Ethereal address above.<br>'
            }
            ${
              data.etherealPassword
                ? '<i class="fas fa-external-link-alt"></i> Access your mailbox at <a href="https://ethereal.email" target="_blank" style="color: var(--primary-color);">ethereal.email</a>'
                : ""
            }
          </p>
        </div>
      `;
      const continueBtn = document.getElementById("continueToLoginBtn");
      if (continueBtn) continueBtn.style.display = "block";

        // Auto-fill login form
        const avatarInput = document.getElementById("avatarNameInput");
        const passwordInput = document.getElementById("avatarPasswordInput");
        if (avatarInput) avatarInput.value = data.avatarName || "";
        if (passwordInput) passwordInput.value = data.password || "";

        console.log("✅ New user setup completed successfully");
      } else {
        console.error("❌ Invalid data received for new user setup:", data);
        content.innerHTML = `
          <div class="status-message error" style="text-align: center;">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Error: Invalid response from server</p>
            <p>Please try again</p>
          </div>
        `;
      }
    } catch (error) {
      console.error("❌ Error in showNewUserSetup:", error);
      const content = document.getElementById("newUserContent");
      if (content) {
        content.innerHTML = `
          <div class="status-message error" style="text-align: center;">
            <i class="fas fa-exclamation-triangle"></i>
            <p>Display error occurred</p>
            <p>Please refresh and try again</p>
          </div>
        `;
      }
    }
  }

  showAvatarLogin() {
    this.showView("authView");
    const elements = [
      "userTypeSelection",
      "newUserSetup",
      "avatarLogin",
      "loginOTPVerification",
      "emailAuth",
      "otpVerification",
    ];
    elements.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === "avatarLogin" ? "block" : "none";
    });
  }

  async showLoginOTPVerification() {
    const elements = [
      "userTypeSelection",
      "newUserSetup",
      "avatarLogin",
      "loginOTPVerification",
    ];
    elements.forEach((id) => {
      const el = document.getElementById(id);
      if (el)
        el.style.display = id === "loginOTPVerification" ? "block" : "none";
    });

    // Get the ethereal email for this user
    if (this.tempUserData && this.tempUserData.avatarName) {
      // We'll need to fetch the email from the backend
      await this.loadUserEtherealEmail();
    }
  }

  async loadUserEtherealEmail() {
    try {
      console.log("Loading ethereal email for:", this.tempUserData.avatarName);
      const response = await fetch(
        `/api/auth/get-user-email/${this.tempUserData.avatarName}`
      );
      const data = await response.json();
      console.log("Email response:", response.status, data);

      if (response.ok && data.email) {
        this.currentEthrealEmail = data.email;
        document.getElementById("etherealEmail").textContent = data.email;
        console.log("✅ Ethereal email loaded:", data.email);
      } else {
        console.error(
          "❌ Failed to load email:",
          data.error || "Unknown error"
        );
        this.showMessage(
          "Failed to load user email. Please try again.",
          "error"
        );
      }
    } catch (error) {
      console.error("❌ Error loading user email:", error);
      this.showMessage(
        "Network error while loading email. Please check your connection.",
        "error"
      );
    }
  }

  showPostLoginOptions() {
    this.showView("mainView");

    const postLoginOptions = document.getElementById("postLoginOptions");
    const appNav = document.getElementById("app-nav");
    const chatContainer = document.getElementById("chatContainer");
    const safeContainer = document.getElementById("safeContainer");

    if (postLoginOptions) postLoginOptions.style.display = "block";
    if (appNav) appNav.style.display = "none";
    if (chatContainer) chatContainer.style.display = "none";
    if (safeContainer) safeContainer.style.display = "none";

    // Update welcome message
    if (this.currentUser && this.currentUser.avatarName) {
      const welcomeAvatar = document.getElementById("welcomeAvatar");
      if (welcomeAvatar) {
        welcomeAvatar.textContent = this.currentUser.avatarName;
      }
    }
  }

  showEmailAuth() {
    this.showView("authView");
    const elements = ["emailAuth", "otpVerification", "avatarLogin"];
    elements.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === "emailAuth" ? "block" : "none";
    });
  }

  showOTPVerification() {
    const elements = ["emailAuth", "otpVerification", "avatarLogin"];
    elements.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = id === "otpVerification" ? "block" : "none";
    });
  }

  showMainInterface() {
    this.showView("mainView");
    const postLoginOptions = document.getElementById("postLoginOptions");
    const appNav = document.getElementById("app-nav");
    if (postLoginOptions) postLoginOptions.style.display = "none";
    if (appNav) appNav.style.display = "block";
    this.updateUserInterface(); // Ensure username is updated
    // Note: showChatInterface() will be called separately when needed
  }

  showChatInterface() {
    // First ensure we're in main interface
    this.showMainInterface();
    const chatContainer = document.getElementById("chatContainer");
    const safeContainer = document.getElementById("safeContainer");
    if (chatContainer) chatContainer.style.display = "block";
    if (safeContainer) safeContainer.style.display = "none";
    this.updateActiveNav("navChat");
  }

  showSafeFolder() {
    const chatContainer = document.getElementById("chatContainer");
    const safeContainer = document.getElementById("safeContainer");
    if (chatContainer) chatContainer.style.display = "none";
    if (safeContainer) safeContainer.style.display = "block";
    safeManager.updateSafeUI();
    this.updateActiveNav("navSafe");
  }

  showSettings() {
    // Placeholder for future settings panel
    showQuickToast("Settings panel coming soon!", "info", 3000);
    this.updateActiveNav("navSettings");
  }

  showView(viewId) {
    // Hide all views
    document.querySelectorAll(".view").forEach((view) => {
      view.style.display = "none";
    });

    // Show target view
    const targetView = document.getElementById(viewId);
    if (targetView) {
      targetView.style.display = "block";
      this.currentView = viewId;
    } else {
      console.error(`❌ View element with id "${viewId}" not found`);
    }
  }

  updateActiveNav(activeNavId) {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.getElementById(activeNavId)?.classList.add("active");
  }

  showLoading(message, buttonElement = null) {
    console.log("Loading:", message);

    // Use the button loading utility if a button is provided
    if (buttonElement) {
      showButtonLoading(buttonElement, message);
    }

    // Show toast notification
    showQuickToast(message, "info", 3000);
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
    this.currentEthrealEmail = null;
    this.tempUserData = null;
    authManager.logout();
    if (chatManager.socket) {
      chatManager.socket.disconnect();
    }
    this.showUserTypeSelection();
    this.showMessage("Secure logout completed.", "info");
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.appManager = new AppManager();
});
