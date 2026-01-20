// API Service for React Native
const API_BASE = __DEV__
  ? "http://localhost:3000/api"
  : "https://your-production-url.com/api";

class ApiService {
  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  async createNewUser() {
    return this.request("/auth/create-new-user", { method: "POST" });
  }

  async sendOTP(email) {
    return this.request("/auth/send-otp", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async verifyOTP(email, otp) {
    return this.request("/auth/verify-otp", {
      method: "POST",
      body: JSON.stringify({ email, otp }),
    });
  }

  async login(avatarName, password) {
    return this.request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ avatarName, password }),
    });
  }

  async verifyLoginOTP(email, avatarName, otp) {
    return this.request("/auth/verify-login-otp", {
      method: "POST",
      body: JSON.stringify({ email, avatarName, otp }),
    });
  }

  async getUserEmail(avatarName) {
    return this.request(`/auth/get-user-email/${avatarName}`);
  }

  async healthCheck() {
    return this.request("/health", { method: "GET" });
  }
}

export const api = new ApiService();
export default api;
