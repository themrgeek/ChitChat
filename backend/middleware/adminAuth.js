const bcrypt = require("bcryptjs");

// Simple admin authentication middleware
// In production, you should use a more robust authentication system
const adminAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Basic ")) {
      return res.status(401).json({ error: "Admin authentication required" });
    }

    const credentials = Buffer.from(authHeader.slice(6), "base64").toString();
    const [username, password] = credentials.split(":");

    // Check against environment variables
    const adminUsername = process.env.ADMIN_USERNAME;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminUsername || !adminPassword) {
      return res
        .status(500)
        .json({ error: "Admin credentials not configured" });
    }

    if (username === adminUsername && password === adminPassword) {
      req.admin = { username };
      next();
    } else {
      return res.status(401).json({ error: "Invalid admin credentials" });
    }
  } catch (error) {
    console.error("Admin auth error:", error);
    res.status(500).json({ error: "Authentication error" });
  }
};

module.exports = { adminAuth };
