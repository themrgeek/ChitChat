const express = require('express');
const router = express.Router();
const profileService = require('./profileService');
const { authenticateSession } = require('../../shared/middleware/auth');
const { APIResponse } = require('../../shared/utils/response');

// All profile routes require authentication
router.use(authenticateSession);

/**
 * GET /api/profile
 * Get current user's profile
 */
router.get('/', async (req, res) => {
  try {
    const result = await profileService.getProfile(req.user.id);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.notFound('Profile'));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Get profile route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to get profile', 500));
  }
});

/**
 * PUT /api/profile
 * Update current user's profile
 */
router.put('/', async (req, res) => {
  try {
    const { displayName, bio, avatarUrl, preferences } = req.body;

    const updates = {};
    if (displayName !== undefined) updates.display_name = displayName;
    if (bio !== undefined) updates.bio = bio;
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl;
    if (preferences !== undefined) updates.preferences = preferences;

    const result = await profileService.updateProfile(req.user.id, updates);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 400));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Update profile route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to update profile', 500));
  }
});

/**
 * PUT /api/profile/status
 * Update online status
 */
router.put('/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!status) {
      return APIResponse.send(res, APIResponse.error('Status is required', 400));
    }

    const result = await profileService.updateOnlineStatus(req.user.id, status);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 400));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Update status route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to update status', 500));
  }
});

/**
 * GET /api/profile/conversations
 * Get user's conversations
 */
router.get('/conversations', async (req, res) => {
  try {
    const { limit, offset, includeInactive } = req.query;

    const options = {
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      includeInactive: includeInactive === 'true'
    };

    const result = await profileService.getUserConversations(req.user.id, options);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 500));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Get conversations route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to get conversations', 500));
  }
});

/**
 * POST /api/profile/conversations
 * Create a new conversation
 */
router.post('/conversations', async (req, res) => {
  try {
    const { title, description, isPrivate } = req.body;

    if (!title) {
      return APIResponse.send(res, APIResponse.error('Title is required', 400));
    }

    const result = await profileService.createConversation(req.user.id, {
      title,
      description,
      isPrivate
    });

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 400));
    }

    APIResponse.send(res, APIResponse.success(result.data, 201));

  } catch (error) {
    console.error('Create conversation route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to create conversation', 500));
  }
});

/**
 * POST /api/profile/conversations/:conversationId/join
 * Join a conversation
 */
router.post('/conversations/:conversationId/join', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const result = await profileService.joinConversation(req.user.id, conversationId);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 400));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Join conversation route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to join conversation', 500));
  }
});

/**
 * POST /api/profile/conversations/:conversationId/leave
 * Leave a conversation
 */
router.post('/conversations/:conversationId/leave', async (req, res) => {
  try {
    const { conversationId } = req.params;

    const result = await profileService.leaveConversation(req.user.id, conversationId);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 400));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Leave conversation route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to leave conversation', 500));
  }
});

/**
 * GET /api/profile/search
 * Search for users
 */
router.get('/search', async (req, res) => {
  try {
    const { q: query, limit, includeInactive } = req.query;

    if (!query) {
      return APIResponse.send(res, APIResponse.error('Search query is required', 400));
    }

    const options = {
      limit: limit ? parseInt(limit) : 20,
      includeInactive: includeInactive === 'true'
    };

    const result = await profileService.searchUsers(query, req.user.id, options);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 400));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Search users route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to search users', 500));
  }
});

/**
 * GET /api/profile/stats
 * Get user statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const result = await profileService.getUserStats(req.user.id);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 500));
    }

    APIResponse.send(res, APIResponse.success(result.data));

  } catch (error) {
    console.error('Get stats route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to get statistics', 500));
  }
});

/**
 * GET /api/profile/:userId
 * Get another user's public profile
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await profileService.getProfile(userId);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.notFound('User'));
    }

    // Return limited profile data for other users
    const profile = result.data.profile;
    const publicProfile = {
      id: profile.id,
      userId: profile.user_id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      status: profile.status,
      lastSeen: profile.last_seen,
      bio: profile.bio,
      user: {
        avatarName: profile.users.avatar_name,
        createdAt: profile.users.created_at
      }
    };

    APIResponse.send(res, APIResponse.success({ profile: publicProfile }));

  } catch (error) {
    console.error('Get user profile route error:', error);
    APIResponse.send(res, APIResponse.notFound('User'));
  }
});

module.exports = router;
