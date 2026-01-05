const express = require('express');
const router = express.Router();
const chatService = require('./chatService');
const { authenticateSession } = require('../../shared/middleware/auth');
const { APIResponse } = require('../../shared/utils/response');

// All chat routes require authentication
router.use(authenticateSession);

/**
 * POST /api/chat/messages
 * Record message metadata (content stays local)
 */
router.post('/messages', async (req, res) => {
  try {
    const {
      conversationId,
      messageType,
      localMessageId,
      contentHash,
      metadata
    } = req.body;

    if (!conversationId || !localMessageId) {
      return APIResponse.send(res, APIResponse.error('Conversation ID and local message ID are required', 400));
    }

    const result = await chatService.recordMessageMetadata({
      conversationId,
      senderId: req.user.id,
      messageType: messageType || 'text',
      localMessageId,
      contentHash,
      metadata: metadata || {}
    });

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 400));
    }

    APIResponse.send(res, APIResponse.success(result.data, 201));

  } catch (error) {
    console.error('Record message route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to record message', 500));
  }
});

/**
 * GET /api/chat/conversations/:conversationId/messages
 * Get conversation messages metadata
 */
router.get('/conversations/:conversationId/messages', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { limit, offset, before, after } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      beforeTimestamp: before,
      afterTimestamp: after
    };

    const result = await chatService.getConversationMessages(conversationId, req.user.id, options);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 403));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Get messages route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to get messages', 500));
  }
});

/**
 * PUT /api/chat/conversations/:conversationId/read
 * Mark messages as read
 */
router.put('/conversations/:conversationId/read', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { lastReadMessageId } = req.body;

    const result = await chatService.markMessagesRead(conversationId, req.user.id, lastReadMessageId);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 403));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Mark read route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to mark messages as read', 500));
  }
});

/**
 * GET /api/chat/conversations/:conversationId
 * Get conversation details
 */
router.get('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const result = await chatService.getConversationDetails(conversationId, req.user.id);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.notFound('Conversation'));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Get conversation route error:', error);
    APIResponse.send(res, APIResponse.notFound('Conversation'));
  }
});

/**
 * PUT /api/chat/conversations/:conversationId
 * Update conversation settings (admin only)
 */
router.put('/conversations/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { title, description } = req.body;

    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;

    const result = await chatService.updateConversation(conversationId, req.user.id, updates);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 403));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Update conversation route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to update conversation', 500));
  }
});

/**
 * GET /api/chat/unread
 * Get unread message counts
 */
router.get('/unread', async (req, res) => {
  try {
    const result = await chatService.getUnreadCounts(req.user.id);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 500));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Get unread counts route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to get unread counts', 500));
  }
});

/**
 * DELETE /api/chat/messages/:messageId
 * Delete message metadata (local content remains)
 */
router.delete('/messages/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;

    const result = await chatService.deleteMessageMetadata(messageId, req.user.id);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 403));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Delete message route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to delete message', 500));
  }
});

/**
 * GET /api/chat/conversations/:conversationId/activity
 * Get conversation activity summary
 */
router.get('/conversations/:conversationId/activity', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { days } = req.query;

    const result = await chatService.getConversationActivity(
      conversationId,
      req.user.id,
      days ? parseInt(days) : 7
    );

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 403));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Get activity route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to get conversation activity', 500));
  }
});

/**
 * POST /api/chat/typing/:conversationId
 * Indicate user is typing (real-time signal, no persistence)
 */
router.post('/typing/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { isTyping } = req.body;

    // Verify user has access to conversation
    const result = await chatService.getConversationDetails(conversationId, req.user.id);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error('Access denied', 403));
    }

    // In a real implementation, this would emit a Socket.IO event
    // For now, just acknowledge
    APIResponse.send(res, APIResponse.success({
      conversationId,
      userId: req.user.id,
      avatarName: req.user.avatar_name,
      isTyping: !!isTyping,
      timestamp: new Date().toISOString()
    }));

  } catch (error) {
    console.error('Typing indicator route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to update typing status', 500));
  }
});

/**
 * GET /api/chat/online-users
 * Get online users (for presence indicators)
 */
router.get('/online-users', async (req, res) => {
  try {
    // Get users who were active in the last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: onlineUsers, error } = await require('../../config/supabase').supabaseAdmin
      .from('user_profiles')
      .select(`
        user_id,
        status,
        last_seen,
        users!inner (
          id,
          avatar_name,
          is_active
        )
      `)
      .eq('users.is_active', true)
      .or(`status.eq.online,and(last_seen.gte.${fiveMinutesAgo})`)
      .limit(100);

    if (error) {
      console.error('Get online users error:', error);
      return APIResponse.send(res, APIResponse.error('Failed to get online users', 500));
    }

    const formattedUsers = onlineUsers.map(user => ({
      userId: user.user_id,
      avatarName: user.users.avatar_name,
      status: user.status,
      lastSeen: user.last_seen
    }));

    APIResponse.send(res, APIResponse.success({
      onlineUsers: formattedUsers,
      count: formattedUsers.length
    }));

  } catch (error) {
    console.error('Get online users route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to get online users', 500));
  }
});

module.exports = router;
