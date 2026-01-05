const express = require('express');
const router = express.Router();

// Import shared middleware
const authMiddleware = require('../../../shared/middleware/auth');

// Import controllers
const authController = require('../controllers/authController');

// Public routes (no authentication required)
router.post('/send-otp', authController.sendOTP);
router.post('/verify-otp', authController.verifyOTP);
router.post('/login', authController.login);
router.post('/refresh-token', authController.refreshToken);

// Protected routes (authentication required)
router.use(authMiddleware.verifyToken);

router.post('/logout', authController.logout);
router.get('/me', authController.getCurrentUser);

// Health check (no auth required for basic health)
router.get('/health', (req, res) => {
  res.json({
    service: 'auth-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
