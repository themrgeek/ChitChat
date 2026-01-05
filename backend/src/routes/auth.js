const express = require("express");
const authController = require("../controllers/authController");

const router = express.Router();

// New user creation flow
router.post("/create-new-user", authController.createNewUser);
router.get("/get-user-email/:avatarName", authController.getUserEmail);
router.get("/email-status/:avatarName", authController.getEmailStatus);

// Existing authentication flow
router.post("/send-otp", authController.sendOTP);
router.post("/verify-otp", authController.verifyOTP);

// Redesigned login flow
router.post("/login", authController.avatarLogin);
router.post("/verify-login-otp", authController.verifyLoginOTP);

router.get("/debug", authController.debugState); // For debugging
router.get("/performance", authController.getPerformanceStats); // Performance monitoring
router.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
}); // Health check endpoint

module.exports = router;
