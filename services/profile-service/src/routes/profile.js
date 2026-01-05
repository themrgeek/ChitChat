const express = require('express');
const router = express.Router();

// Import controller
const profileController = require('../controllers/profileController');

// Profile routes
router.get('/', profileController.getProfile);
router.put('/', profileController.updateProfile);
router.get('/stats', profileController.getStats);
router.put('/online-status', profileController.updateOnlineStatus);

// Conversation routes
router.get('/conversations', profileController.getConversations);
router.post('/conversations', profileController.upsertConversation);
router.put('/conversations/:conversationId/activity', profileController.updateConversationActivity);
router.delete('/conversations/:conversationId', profileController.deleteConversation);

// Health check
router.get('/health', (req, res) => {
  res.json({
    service: 'profile-service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
