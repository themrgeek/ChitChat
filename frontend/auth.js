class AuthManager {
  constructor() {
    this.apiBase = "http://localhost:3000/api";
    this.socket = null;
    this.sessionId = localStorage.getItem("sessionId");
    this.anonymousId = localStorage.getItem("anonymousId");
    this.avatar = localStorage.getItem("avatar");
  }

  // Initialize authentication event listeners
  init() {
    // New user button
    document.getElementById("new-user-btn").addEventListener("click", () => {
      this.showForm("new-user-form");
    });

    // Existing user button
    document
      .getElementById("existing-user-btn")
      .addEventListener("click", () => {
        this.showForm("existing-user-form");
      });

    // Register button
    document.getElementById("register-btn").addEventListener("click", () => {
      this.registerUser();
    });

    // Login button
    document.getElementById("login-btn").addEventListener("click", () => {
      this.loginUser();
    });

    // Avatar selection
    document.querySelectorAll(".avatar").forEach((avatarEl) => {
      avatarEl.addEventListener("click", (e) => {
        const avatarValue = e.currentTarget.dataset.avatar;
        this.selectAvatar(avatarValue);
      });
    });

    // Enter chat button
    const enterChatBtn = document.getElementById("enter-chat-btn");
    if (enterChatBtn) {
      enterChatBtn.addEventListener("click", () => {
        this.enterChat();
      });
    }

    // Logout button (if present)
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", () => {
        this.logout();
      });
    }

    // Check for existing session
    if (this.sessionId) {
      this.verifySession();
    }
  }

  showForm(formId) {
    // Hide all forms
    document.querySelectorAll(".form").forEach((form) => {
      form.classList.add("hidden");
    });

    // Show selected form
    const el = document.getElementById(formId);
    if (el) el.classList.remove("hidden");
  }

  async registerUser() {
    const nationalId = document.getElementById("national-id").value;
    const email = document.getElementById("email").value;

    if (!nationalId || !email) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nationalId, email }),
      });

      const data = await response.json();

      if (response.ok) {
        this.showCredentials(data.anonymousCredentials);
      } else {
        alert("Registration failed: " + data.error);
      }
    } catch (error) {
      console.error("Registration error:", error);
      alert("Registration failed. Please try again.");
    }
  }

  async loginUser() {
    const nationalId = document.getElementById("login-national-id").value;
    const email = document.getElementById("login-email").value;

    if (!nationalId || !email) {
      alert("Please fill in all fields");
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ nationalId, email }),
      });

      const data = await response.json();

      if (response.ok) {
        this.saveSession(data);
        this.showAvatarSelection(data.avatar);
      } else {
        alert("Login failed: " + data.error);
      }
    } catch (error) {
      console.error("Login error:", error);
      alert("Login failed. Please try again.");
    }
  }

  async verifySession() {
    try {
      const response = await fetch(
        `${this.apiBase}/auth/verify-session/${this.sessionId}`
      );
      const data = await response.json();

      if (data.valid) {
        // fetch profile to populate avatar / anonymousId from server
        await this.fetchProfile();
        this.showChatScreen();
      } else {
        this.clearSession();
      }
    } catch (error) {
      console.error("Session verification error:", error);
      this.clearSession();
    }
  }

  showCredentials(credentials) {
    document.getElementById("anonymous-id").textContent =
      credentials.anonymousId;
    document.getElementById("private-key").textContent = credentials.privateKey;
    document.getElementById("credentials-display").classList.remove("hidden");

    // Store temporarily for avatar selection
    this.anonymousId = credentials.anonymousId;
  }

  selectAvatar(avatar) {
    // Remove selected class from all avatars
    document.querySelectorAll(".avatar").forEach((av) => {
      av.classList.remove("selected");
    });

    // Add selected class to the avatar element (if exists)
    const avatarElement = document.querySelector(
      `.avatar[data-avatar="${avatar}"]`
    );
    if (avatarElement) {
      avatarElement.classList.add("selected");
    }

    // Show enter chat button
    const enterBtn = document.getElementById("enter-chat-btn");
    if (enterBtn) enterBtn.classList.remove("hidden");

    // Store selected avatar locally
    this.avatar = avatar;
  }

  saveSession(data) {
    this.sessionId = data.sessionId;
    this.anonymousId = data.anonymousId;
    this.avatar = data.avatar;

    // Store in localStorage
    localStorage.setItem("sessionId", data.sessionId);
    localStorage.setItem("anonymousId", data.anonymousId);
    localStorage.setItem("avatar", data.avatar);
  }

  clearSession() {
    this.sessionId = null;
    this.anonymousId = null;
    this.avatar = null;

    localStorage.removeItem("sessionId");
    localStorage.removeItem("anonymousId");
    localStorage.removeItem("avatar");
  }

  showAvatarSelection(defaultAvatar = "👤") {
    document.getElementById("credentials-display").classList.remove("hidden");
    document.getElementById("anonymous-id").textContent = this.anonymousId;
    document.getElementById("private-key").textContent = "••••••••••••";

    // Select default avatar
    const avatarElement = document.querySelector(
      `.avatar[data-avatar="${defaultAvatar}"]`
    );
    if (avatarElement) {
      avatarElement.classList.add("selected");
      this.avatar = defaultAvatar;
    }

    document.getElementById("enter-chat-btn").classList.remove("hidden");
  }

  enterChat() {
    if (!this.avatar) {
      alert("Please select an avatar");
      return;
    }

    // Save avatar to localStorage
    localStorage.setItem("avatar", this.avatar);

    // Update avatar on server (best-effort)
    if (this.sessionId) {
      this.updateAvatar(this.avatar).catch((err) => {
        console.warn("Avatar update failed (non-fatal):", err);
      });
    }

    // Initialize socket connection
    this.initSocket();

    // Show chat screen
    this.showChatScreen();
  }

  initSocket() {
    // Connect to Socket.io server with session ID
    this.socket = io("http://localhost:3000", {
      auth: {
        sessionId: this.sessionId,
      },
    });

    // Handle connection events
    this.socket.on("connect", () => {
      console.log("Connected to server");
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
    });

    this.socket.on("connect_error", (error) => {
      console.error("Connection error:", error);
      alert("Connection failed. Please try again.");
    });
  }

  showChatScreen() {
    const authScreen = document.getElementById("auth-screen");
    const chatScreen = document.getElementById("chat-screen");
    if (authScreen) authScreen.classList.remove("active");
    if (chatScreen) chatScreen.classList.add("active");

    // Set user info in chat screen
    const userAvatarEl = document.getElementById("user-avatar");
    const userIdEl = document.getElementById("user-id");
    if (userAvatarEl) userAvatarEl.textContent = this.avatar || "👤";
    if (userIdEl) userIdEl.textContent = this.anonymousId || "";

    // Initialize chat functionality if socket is connected
    if (this.socket && window.chatManager) {
      window.chatManager.init(this.socket, this.anonymousId, this.avatar);
    }
  }

  // New client-side helpers for the added API endpoints

  // Fetch user profile (GET /auth/profile)
  async fetchProfile() {
    if (!this.sessionId) return;

    try {
      const response = await fetch(`${this.apiBase}/auth/profile`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch profile");
      }

      const data = await response.json();
      // Update local state/storage
      this.anonymousId = data.anonymousId || this.anonymousId;
      this.avatar = data.avatar || this.avatar;
      localStorage.setItem("anonymousId", this.anonymousId || "");
      if (this.avatar) localStorage.setItem("avatar", this.avatar);

      // update UI if on avatar selection or chat
      const anonEl = document.getElementById("anonymous-id");
      if (anonEl) anonEl.textContent = this.anonymousId;
      const userAvatarEl = document.getElementById("user-avatar");
      if (userAvatarEl) userAvatarEl.textContent = this.avatar || "👤";
    } catch (error) {
      console.error("fetchProfile error:", error);
      throw error;
    }
  }

  // Update avatar on server (PUT /auth/avatar)
  async updateAvatar(avatar) {
    if (!this.sessionId) {
      throw new Error("No session");
    }
    try {
      const response = await fetch(`${this.apiBase}/auth/avatar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
        body: JSON.stringify({ avatar }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to update avatar");
      }

      // Update local state/storage
      this.avatar = avatar;
      localStorage.setItem("avatar", avatar);

      // Reflect change in UI
      const userAvatarEl = document.getElementById("user-avatar");
      if (userAvatarEl) userAvatarEl.textContent = avatar;

      return data;
    } catch (error) {
      console.error("updateAvatar error:", error);
      throw error;
    }
  }

  // Logout (POST /auth/logout)
  async logout() {
    if (!this.sessionId) {
      this.clearSession();
      window.location.reload();
      return;
    }

    try {
      const response = await fetch(`${this.apiBase}/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Id": this.sessionId,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Logout failed");
      }

      // Close socket if exists
      if (this.socket) {
        try {
          this.socket.disconnect();
        } catch (e) {}
        this.socket = null;
      }

      this.clearSession();

      // Return to auth screen
      const authScreen = document.getElementById("auth-screen");
      const chatScreen = document.getElementById("chat-screen");
      if (chatScreen) chatScreen.classList.remove("active");
      if (authScreen) authScreen.classList.add("active");

      return data;
    } catch (error) {
      console.error("logout error:", error);
      alert("Logout failed. Please try again.");
    }
  }
}

// Initialize auth manager when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.authManager = new AuthManager();
  window.authManager.init();
});
