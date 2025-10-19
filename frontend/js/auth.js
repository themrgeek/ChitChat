class AuthManager {
  constructor() {
    this.currentUser = null;
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
    if (userData) {
      try {
        const user = JSON.parse(userData);
        this.currentUser = user;
        this.isAuthenticated = true;
        console.log("✅ Existing session found:", user.avatarName);
        return user;
      } catch (error) {
        console.error("❌ Error parsing stored user data:", error);
        this.clearSession();
      }
    }
    return null;
  }

  // Store user session
  storeSession(userData) {
    this.currentUser = userData;
    this.isAuthenticated = true;

    // Store in localStorage
    localStorage.setItem(
      "chitchat_user",
      JSON.stringify({
        avatarName: userData.avatarName,
        publicKey: userData.publicKey,
        loginTime: new Date().toISOString(),
      })
    );

    console.log("✅ User session stored:", userData.avatarName);
  }

  // Clear session (logout)
  clearSession() {
    this.currentUser = null;
    this.isAuthenticated = false;
    localStorage.removeItem("chitchat_user");
    console.log("✅ User session cleared");
  }

  // Send OTP to email
  async sendOTP(email) {
    try {
      console.log("Sending OTP to:", email);

      const response = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("OTP sent successfully:", data);
        return data;
      } else {
        throw new Error(data.error || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Send OTP error:", error);
      throw error;
    }
  }

  // Verify OTP
  async verifyOTP(email, otp) {
    try {
      console.log("Verifying OTP:", { email, otp });

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
          avatarName: data.avatarName,
          password: data.password,
          privateKey: data.privateKey,
          publicKey: data.publicKey,
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

  // Avatar login - THIS IS WHERE THE SESSION IS CREATED
  async avatarLogin(avatarName, password) {
    try {
      console.log("Logging in:", { avatarName });

      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ avatarName, password }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log("Login successful:", data);

        // Store the session
        this.storeSession({
          avatarName: data.avatarName,
          publicKey: data.publicKey,
          loginTime: new Date(),
        });

        return data;
      } else {
        throw new Error(data.error || "Login failed");
      }
    } catch (error) {
      console.error("Login error:", error);
      throw error;
    }
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
