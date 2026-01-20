const API_BASE = "/api";

// ⚡ PERFORMANCE: Request cache for repeated calls
const requestCache = new Map();
const CACHE_TTL = 30000; // 30 seconds

class ApiService {
  constructor() {
    // ⚡ Pre-warm connection on init
    this.warmConnection();
  }

  // ⚡ Pre-warm the connection to reduce first request latency
  async warmConnection() {
    try {
      // Ping health endpoint to establish connection
      fetch('/api/health', { method: 'GET', keepalive: true }).catch(() => {});
    } catch (e) {
      // Ignore errors
    }
  }

  // ⚡ Get from cache if available
  getCached(key) {
    const cached = requestCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }
    requestCache.delete(key);
    return null;
  }

  // ⚡ Set cache
  setCache(key, data) {
    requestCache.set(key, { data, timestamp: Date.now() });
  }

  async request(endpoint, options = {}) {
    const startTime = performance.now();
    const url = `${API_BASE}${endpoint}`;
    
    // ⚡ Check cache for GET requests
    const cacheKey = `${options.method || 'GET'}-${url}`;
    if (!options.method || options.method === 'GET') {
      const cached = this.getCached(cacheKey);
      if (cached) {
        console.log(`⚡ Cache hit: ${endpoint} (0ms)`);
        return cached;
      }
    }

    const config = {
      headers: {
        "Content-Type": "application/json",
        "Connection": "keep-alive", // ⚡ Keep connection alive
        ...options.headers,
      },
      keepalive: true, // ⚡ Keep connection alive
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();
      
      const duration = Math.round(performance.now() - startTime);
      console.log(`⚡ API: ${endpoint} - ${duration}ms`);

      if (!response.ok) {
        throw new Error(data.error || "Request failed");
      }

      // ⚡ Cache GET responses
      if (!options.method || options.method === 'GET') {
        this.setCache(cacheKey, data);
      }

      return data;
    } catch (error) {
      console.error(`API Error [${endpoint}]:`, error);
      throw error;
    }
  }

  // Auth endpoints
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

  // Health check
  async healthCheck() {
    return this.request("/health", { method: "GET" });
  }
}

export const api = new ApiService();
export default api;
