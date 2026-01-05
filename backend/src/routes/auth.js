// Legacy routes - redirecting to new microservice architecture
const express = require("express");
const router = express.Router();

// Import new auth routes
const newAuthRoutes = require("../services/auth/authRoutes");

// Mount new auth routes
router.use("/", newAuthRoutes);

// Legacy compatibility endpoints (redirect to new routes)
router.post("/create-new-user", (req, res) => {
  console.log("⚠️ Legacy create-new-user endpoint called, redirecting...");
  // This is now handled differently - users go through OTP flow
  res.redirect(307, "/api/auth/send-otp");
});

router.get("/get-user-email/:avatarName", (req, res) => {
  console.log("⚠️ Legacy get-user-email endpoint called, redirecting...");
  res.status(410).json({ error: "This endpoint is deprecated. Use the new auth system." });
});

router.get("/email-status/:avatarName", (req, res) => {
  console.log("⚠️ Legacy email-status endpoint called, redirecting...");
  res.status(410).json({ error: "This endpoint is deprecated. Use the new auth system." });
});

// Keep some legacy endpoints for backward compatibility
const authController = require("../controllers/authController");

// Debug and maintenance endpoints
router.get("/debug", authController.debugState); // For debugging
router.get("/performance", authController.getPerformanceStats); // Performance monitoring
router.post("/backup-data", authController.createDataBackup); // Manual backup

// Health check endpoints
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    message: "Using new microservice architecture",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

router.get("/email-health", async (req, res) => {
  const emailService = require("../config/emailService");
  const health = await emailService.healthCheck();
  res.json(health);
});

module.exports = router;
