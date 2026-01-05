class AuthManager {
  constructor() {
    this.currentUser = null;
    this.currentSession = null;
    this.isAuthenticated = false;
    this.initializeAuth();
  }

  initializeAuth() {
    // Check for existing session on load
    this.checkExistingSession();
  }

  // Check if user is logged in from localStorage
  checkExistingSession() {
    const userData = localStorage.getItem("chitchat_user");
    const sessionData = localStorage.getItem("chitchat_session");

    if (userData && sessionData) {
      try {
        const user = JSON.parse(userData);
        const session = JSON.parse(sessionData);

        // Check if session is still valid
        if (new Date(session.expiresAt) > new Date()) {
          this.currentUser = user;
          this.currentSession = session;
          this.isAuthenticated = true;
          console.log("✅ Existing session found:", user.avatarName);
          return user;
        } else {
          console.log("⏰ Session expired, clearing...");
          this.clearSession();
        }
      } catch (error) {
        console.error("❌ Error parsing stored user/session data:", error);
        this.clearSession();
      }
    }
    return null;
  }

  // Store user session
  storeSession(userData, sessionData) {
    this.currentUser = userData;
    this.currentSession = sessionData;
    this.isAuthenticated = true;

    // Store in localStorage
    localStorage.setItem(
      "chitchat_user",
      JSON.stringify({
        id: userData.id,
        avatarName: userData.avatarName,
        email: userData.email,
        emailVerified: userData.emailVerified,
        lastLogin: userData.lastLogin,
        loginTime: new Date().toISOString(),
      })
    );

    localStorage.setItem(
      "chitchat_session",
      JSON.stringify({
        token: sessionData.token,
        expiresAt: sessionData.expiresAt,
        deviceInfo: sessionData.deviceInfo,
      })
    );

    console.log("✅ User session stored:", userData.avatarName);
  }

  // Clear session (logout)
  clearSession() {
    this.currentUser = null;
    this.currentSession = null;
    this.isAuthenticated = false;
    localStorage.removeItem("chitchat_user");
    localStorage.removeItem("chitchat_session");
    console.log("✅ User session cleared");
  }

  // Send OTP to email for registration
  async sendOTP(email) {
    try {
      console.log("Sending registration OTP to:", email);

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Registration OTP sent successfully:", data);
        return data;
      } else {
        throw new Error(data.error || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      throw error;
    }
  }

  // Verify OTP for registration
  async verifyOTP(email, otp) {
    try {
      console.log("Verifying registration OTP:", { email, otp });

      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, otp }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("OTP verified successfully:", data);

        // Store user data temporarily (not full session yet)
        this.tempUserData = {
          id: data.userId,
          avatarName: data.avatarName,
          password: data.password,
        };

        return data;
      } else {
        throw new Error(data.error || "Invalid OTP");
      }
    } catch (error) {
      console.error("Verify OTP error:", error);
      throw error;
    }
  }

  // Avatar login - Step 1: Verify credentials and send login OTP
  async avatarLogin(avatarName, password) {
    try {
      console.log("Logging in - Step 1:", { avatarName });

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatarName, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Login credentials verified, OTP sent:", data);

        // Store user data temporarily
        this.tempUserData = {
          id: data.userId,
          avatarName: data.avatarName,
        };

        return data;
      } else {
        throw new Error(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
  }

  // Verify login OTP - Step 2: Complete login
  async verifyLoginOTP(email, otp) {
    try {
      console.log("Verifying login OTP - Step 2:", { email });

      const response = await fetch("/api/auth/verify-login-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email,
          avatarName: this.tempUserData?.avatarName,
          otp: otp
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Login OTP verified successfully:", data);

        // Store the full session
        if (data.session) {
          this.storeSession({
            id: this.tempUserData.id,
            avatarName: data.avatarName,
            email: email,
            emailVerified: true,
            lastLogin: new Date().toISOString(),
          }, data.session);
        }

        // Clear temp data
        this.tempUserData = null;

        return data;
      } else {
        throw new Error(data.error || "Invalid login OTP");
      }
    } catch (error) {
      console.error("Verify login OTP error:", error);
      throw error;
    }
  }

  // Validate current session
  async validateSession() {
    if (!this.currentSession?.token) {
      return false;
    }

    try {
      const response = await fetch("/api/auth/validate-session", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.currentSession.token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Session validated:", data);
        return true;
      } else {
        console.log("Session invalid, clearing...");
        this.clearSession();
        return false;
      }
    } catch (error) {
      console.error("Session validation error:", error);
      this.clearSession();
      return false;
    }
  }

  // Logout
  async logout() {
    if (this.currentSession?.token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${this.currentSession.token}`,
          },
        });
      } catch (error) {
        console.error("Logout API error:", error);
        // Continue with local logout even if API fails
      }
    }

    this.clearSession();
    console.log("✅ Logout completed");
  }

  // Check if user is logged in
  isLoggedIn() {
    return this.isAuthenticated && this.currentUser !== null;
  }

  // Get current user info
  getUserInfo() {
    return this.currentUser;
  }
}

// Global auth instance
window.authManager = new AuthManager();
