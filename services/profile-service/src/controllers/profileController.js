const { supabase } = require('../../../shared/config/supabase');

class ProfileController {
  // Get user profile
  async getProfile(req, res) {
    try {
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select(`
          id,
          display_name,
          bio,
          avatar_url,
          is_online,
          last_seen,
          preferences,
          created_at,
          updated_at,
          users!inner (
            id,
            email,
            avatar_name,
            created_at,
            last_login,
            email_verified
          )
        `)
        .eq('user_id', req.user.id)
        .single();

      if (error) {
        console.error('Get profile error:', error);
        return res.status(404).json({
          error: 'Profile not found',
          code: 'PROFILE_NOT_FOUND'
        });
      }

      // Get conversation statistics
      const { count: conversationCount, error: convError } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id);

      if (convError) {
        console.error('Conversation count error:', convError);
      }

      const profileData = {
        ...profile,
        conversationCount: conversationCount || 0,
        user: profile.users
      };

      // Remove nested users object
      delete profileData.users;

      res.json({
        profile: profileData
      });

    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        error: 'Failed to get profile',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Update user profile
  async updateProfile(req, res) {
    try {
      const { displayName, bio, preferences } = req.body;

      // Validate input
      if (displayName && (displayName.length < 2 || displayName.length > 100)) {
        return res.status(400).json({
          error: 'Display name must be between 2 and 100 characters',
          code: 'INVALID_DISPLAY_NAME'
        });
      }

      if (bio && bio.length > 500) {
        return res.status(400).json({
          error: 'Bio must be less than 500 characters',
          code: 'BIO_TOO_LONG'
        });
      }

      // Update profile
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (displayName !== undefined) updateData.display_name = displayName;
      if (bio !== undefined) updateData.bio = bio;
      if (preferences !== undefined) updateData.preferences = preferences;

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', req.user.id)
        .select()
        .single();

      if (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({
          error: 'Failed to update profile',
          code: 'UPDATE_FAILED'
        });
      }

      res.json({
        message: 'Profile updated successfully',
        profile
      });

    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({
        error: 'Failed to update profile',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Get user conversations
  async getConversations(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = Math.min(parseInt(req.query.limit) || 20, 50); // Max 50 per page
      const offset = (page - 1) * limit;

      const { data: conversations, error, count } = await supabase
        .from('conversations')
        .select('*', { count: 'exact' })
        .eq('user_id', req.user.id)
        .order('last_message_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Get conversations error:', error);
        return res.status(500).json({
          error: 'Failed to get conversations',
          code: 'FETCH_FAILED'
        });
      }

      res.json({
        conversations: conversations || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          pages: Math.ceil((count || 0) / limit)
        }
      });

    } catch (error) {
      console.error('Get conversations error:', error);
      res.status(500).json({
        error: 'Failed to get conversations',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Create or update conversation metadata
  async upsertConversation(req, res) {
    try {
      const { conversationId, title, participantCount } = req.body;

      if (!conversationId) {
        return res.status(400).json({
          error: 'Conversation ID is required',
          code: 'CONVERSATION_ID_REQUIRED'
        });
      }

      const { data: conversation, error } = await supabase
        .from('conversations')
        .upsert({
          user_id: req.user.id,
          conversation_id: conversationId,
          title: title || 'Untitled Conversation',
          participant_count: participantCount || 1,
          last_message_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,conversation_id'
        })
        .select()
        .single();

      if (error) {
        console.error('Upsert conversation error:', error);
        return res.status(500).json({
          error: 'Failed to save conversation',
          code: 'SAVE_FAILED'
        });
      }

      res.json({
        message: 'Conversation saved successfully',
        conversation
      });

    } catch (error) {
      console.error('Upsert conversation error:', error);
      res.status(500).json({
        error: 'Failed to save conversation',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Update conversation last message time
  async updateConversationActivity(req, res) {
    try {
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({
          error: 'Conversation ID is required',
          code: 'CONVERSATION_ID_REQUIRED'
        });
      }

      const { data: conversation, error } = await supabase
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString()
        })
        .eq('user_id', req.user.id)
        .eq('conversation_id', conversationId)
        .select()
        .single();

      if (error) {
        console.error('Update conversation activity error:', error);
        return res.status(500).json({
          error: 'Failed to update conversation activity',
          code: 'UPDATE_FAILED'
        });
      }

      res.json({
        message: 'Conversation activity updated',
        conversation
      });

    } catch (error) {
      console.error('Update conversation activity error:', error);
      res.status(500).json({
        error: 'Failed to update conversation activity',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Delete conversation
  async deleteConversation(req, res) {
    try {
      const { conversationId } = req.params;

      if (!conversationId) {
        return res.status(400).json({
          error: 'Conversation ID is required',
          code: 'CONVERSATION_ID_REQUIRED'
        });
      }

      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('user_id', req.user.id)
        .eq('conversation_id', conversationId);

      if (error) {
        console.error('Delete conversation error:', error);
        return res.status(500).json({
          error: 'Failed to delete conversation',
          code: 'DELETE_FAILED'
        });
      }

      res.json({
        message: 'Conversation deleted successfully'
      });

    } catch (error) {
      console.error('Delete conversation error:', error);
      res.status(500).json({
        error: 'Failed to delete conversation',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Get user statistics
  async getStats(req, res) {
    try {
      // Get conversation count
      const { count: conversationCount } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', req.user.id);

      // Get total messages sent (if we had a messages table)
      // For now, just return basic stats
      const stats = {
        conversations: conversationCount || 0,
        accountAge: Math.floor((Date.now() - new Date(req.user.created_at).getTime()) / (1000 * 60 * 60 * 24)), // days
        lastLogin: req.user.last_login,
        isActive: req.user.is_active
      };

      res.json({ stats });

    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        error: 'Failed to get statistics',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Update online status
  async updateOnlineStatus(req, res) {
    try {
      const { isOnline } = req.body;

      const updateData = {
        is_online: isOnline,
        last_seen: new Date().toISOString()
      };

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', req.user.id)
        .select()
        .single();

      if (error) {
        console.error('Update online status error:', error);
        return res.status(500).json({
          error: 'Failed to update online status',
          code: 'UPDATE_FAILED'
        });
      }

      res.json({
        message: 'Online status updated',
        profile
      });

    } catch (error) {
      console.error('Update online status error:', error);
      res.status(500).json({
        error: 'Failed to update online status',
        code: 'INTERNAL_ERROR'
      });
    }
  }
}

module.exports = new ProfileController();
