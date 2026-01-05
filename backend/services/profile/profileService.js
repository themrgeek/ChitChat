const { supabaseAdmin } = require('../../src/config/supabase');
const { profileCache, conversationCache } = require('../../shared/utils/cache');
const { ServiceResult } = require('../../shared/utils/response');

class ProfileService {
  /**
   * Get user profile by user ID
   * @param {string} userId - User ID
   * @returns {ServiceResult}
   */
  async getProfile(userId) {
    try {
      const cacheKey = `profile:${userId}`;
      let profile = profileCache.get(cacheKey);

      if (!profile) {
        const { data, error } = await supabaseAdmin
          .from('user_profiles')
          .select(`
            *,
            users!inner (
              id,
              email,
              avatar_name,
              email_verified,
              is_active,
              created_at,
              last_login
            )
          `)
          .eq('user_id', userId)
          .single();

        if (error || !data) {
          return ServiceResult.failure(error || new Error('Profile not found'), 'Profile not found');
        }

        profile = data;
        profileCache.set(cacheKey, profile, 1800000); // 30 minutes
      }

      // Get conversation count
      const { count: conversationCount } = await supabaseAdmin
        .from('conversation_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      return ServiceResult.success({
        profile: {
          ...profile,
          conversationCount: conversationCount || 0
        }
      }, 'Profile retrieved successfully');

    } catch (error) {
      console.error('Get profile service error:', error);
      return ServiceResult.failure(error, 'Failed to retrieve profile');
    }
  }

  /**
   * Update user profile
   * @param {string} userId - User ID
   * @param {Object} updates - Profile updates
   * @returns {ServiceResult}
   */
  async updateProfile(userId, updates) {
    try {
      const allowedFields = ['display_name', 'bio', 'avatar_url', 'preferences'];
      const filteredUpdates = {};

      // Filter allowed fields and validate
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'display_name' && updates[key]) {
            // Validate display name length
            if (updates[key].length < 2 || updates[key].length > 100) {
              throw new Error('Display name must be between 2 and 100 characters');
            }
          }
          if (key === 'bio' && updates[key] && updates[key].length > 500) {
            throw new Error('Bio must be less than 500 characters');
          }
          filteredUpdates[key] = updates[key];
        }
      });

      if (Object.keys(filteredUpdates).length === 0) {
        return ServiceResult.failure(new Error('No valid fields to update'), 'No valid fields provided');
      }

      // Add updated_at timestamp
      filteredUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update(filteredUpdates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Profile update error:', error);
        return ServiceResult.failure(error, 'Failed to update profile');
      }

      // Clear cache
      profileCache.delete(`profile:${userId}`);

      return ServiceResult.success({
        profile: data
      }, 'Profile updated successfully');

    } catch (error) {
      console.error('Update profile service error:', error);
      return ServiceResult.failure(error, 'Failed to update profile');
    }
  }

  /**
   * Update user online status
   * @param {string} userId - User ID
   * @param {string} status - Online status (online, offline, away)
   * @returns {ServiceResult}
   */
  async updateOnlineStatus(userId, status) {
    try {
      const validStatuses = ['online', 'offline', 'away'];
      if (!validStatuses.includes(status)) {
        return ServiceResult.failure(new Error('Invalid status'), 'Invalid status value');
      }

      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'online' || status === 'away') {
        updateData.last_seen = new Date().toISOString();
      }

      const { data, error } = await supabaseAdmin
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Status update error:', error);
        return ServiceResult.failure(error, 'Failed to update status');
      }

      // Clear cache
      profileCache.delete(`profile:${userId}`);

      return ServiceResult.success({
        profile: data
      }, 'Status updated successfully');

    } catch (error) {
      console.error('Update status service error:', error);
      return ServiceResult.failure(error, 'Failed to update status');
    }
  }

  /**
   * Get user's conversations
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {ServiceResult}
   */
  async getUserConversations(userId, options = {}) {
    try {
      const { limit = 50, offset = 0, includeInactive = false } = options;
      const cacheKey = `conversations:${userId}:${limit}:${offset}:${includeInactive}`;

      let conversations = conversationCache.get(cacheKey);

      if (!conversations) {
        let query = supabaseAdmin
          .from('conversation_participants')
          .select(`
            conversations (
              id,
              conversation_id,
              title,
              description,
              created_by,
              participant_count,
              last_message_at,
              is_active,
              created_at,
              updated_at
            ),
            joined_at,
            last_read_at,
            role,
            is_active
          `)
          .eq('user_id', userId);

        if (!includeInactive) {
          query = query.eq('is_active', true);
        }

        const { data, error } = await query
          .order('joined_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) {
          console.error('Get conversations error:', error);
          return ServiceResult.failure(error, 'Failed to get conversations');
        }

        conversations = data.map(item => ({
          ...item.conversations,
          participantInfo: {
            joinedAt: item.joined_at,
            lastReadAt: item.last_read_at,
            role: item.role,
            isActive: item.is_active
          }
        }));

        conversationCache.set(cacheKey, conversations, 300000); // 5 minutes
      }

      return ServiceResult.success({
        conversations,
        pagination: {
          limit,
          offset,
          hasMore: conversations.length === limit
        }
      }, 'Conversations retrieved successfully');

    } catch (error) {
      console.error('Get conversations service error:', error);
      return ServiceResult.failure(error, 'Failed to get conversations');
    }
  }

  /**
   * Create a new conversation
   * @param {string} creatorId - User ID of creator
   * @param {Object} conversationData - Conversation data
   * @returns {ServiceResult}
   */
  async createConversation(creatorId, conversationData) {
    try {
      const { title, description, isPrivate = false } = conversationData;

      if (!title || title.trim().length === 0) {
        return ServiceResult.failure(new Error('Title is required'), 'Conversation title is required');
      }

      if (title.length > 255) {
        return ServiceResult.failure(new Error('Title too long'), 'Title must be less than 255 characters');
      }

      // Generate unique conversation ID
      const conversationId = this.generateConversationId();

      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .insert({
          conversation_id: conversationId,
          title: title.trim(),
          description: description?.trim(),
          created_by: creatorId,
          participant_count: 1,
          is_active: true
        })
        .select()
        .single();

      if (error) {
        console.error('Conversation creation error:', error);
        return ServiceResult.failure(error, 'Failed to create conversation');
      }

      // Add creator as participant
      const { error: participantError } = await supabaseAdmin
        .from('conversation_participants')
        .insert({
          conversation_id: conversation.id,
          user_id: creatorId,
          role: 'admin',
          joined_at: new Date().toISOString()
        });

      if (participantError) {
        console.error('Participant creation error:', participantError);
        // Try to clean up the conversation
        await supabaseAdmin
          .from('conversations')
          .delete()
          .eq('id', conversation.id);

        return ServiceResult.failure(participantError, 'Failed to add creator to conversation');
      }

      // Clear cache
      conversationCache.clear();

      return ServiceResult.success({
        conversation: {
          ...conversation,
          participantInfo: {
            joinedAt: conversation.created_at,
            role: 'admin',
            isActive: true
          }
        }
      }, 'Conversation created successfully');

    } catch (error) {
      console.error('Create conversation service error:', error);
      return ServiceResult.failure(error, 'Failed to create conversation');
    }
  }

  /**
   * Join a conversation
   * @param {string} userId - User ID
   * @param {string} conversationId - Conversation ID
   * @returns {ServiceResult}
   */
  async joinConversation(userId, conversationId) {
    try {
      // Check if conversation exists and is active
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('id, is_active, participant_count')
        .eq('conversation_id', conversationId)
        .single();

      if (convError || !conversation) {
        return ServiceResult.failure(new Error('Conversation not found'), 'Conversation not found');
      }

      if (!conversation.is_active) {
        return ServiceResult.failure(new Error('Conversation inactive'), 'Conversation is no longer active');
      }

      // Check if user is already a participant
      const { data: existingParticipant } = await supabaseAdmin
        .from('conversation_participants')
        .select('id, is_active')
        .eq('conversation_id', conversation.id)
        .eq('user_id', userId)
        .single();

      if (existingParticipant) {
        if (existingParticipant.is_active) {
          return ServiceResult.failure(new Error('Already joined'), 'Already a participant in this conversation');
        } else {
          // Rejoin
          const { error: rejoinError } = await supabaseAdmin
            .from('conversation_participants')
            .update({
              is_active: true,
              joined_at: new Date().toISOString()
            })
            .eq('id', existingParticipant.id);

          if (rejoinError) {
            return ServiceResult.failure(rejoinError, 'Failed to rejoin conversation');
          }
        }
      } else {
        // Add as new participant
        const { error: participantError } = await supabaseAdmin
          .from('conversation_participants')
          .insert({
            conversation_id: conversation.id,
            user_id: userId,
            role: 'member',
            joined_at: new Date().toISOString()
          });

        if (participantError) {
          return ServiceResult.failure(participantError, 'Failed to join conversation');
        }

        // Update participant count
        await supabaseAdmin
          .from('conversations')
          .update({
            participant_count: conversation.participant_count + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id);
      }

      // Clear cache
      conversationCache.clear();

      return ServiceResult.success({
        conversationId,
        action: existingParticipant ? 'rejoined' : 'joined'
      }, `Successfully ${existingParticipant ? 'rejoined' : 'joined'} conversation`);

    } catch (error) {
      console.error('Join conversation service error:', error);
      return ServiceResult.failure(error, 'Failed to join conversation');
    }
  }

  /**
   * Leave a conversation
   * @param {string} userId - User ID
   * @param {string} conversationId - Conversation ID
   * @returns {ServiceResult}
   */
  async leaveConversation(userId, conversationId) {
    try {
      // Get conversation
      const { data: conversation, error: convError } = await supabaseAdmin
        .from('conversations')
        .select('id, participant_count, created_by')
        .eq('conversation_id', conversationId)
        .single();

      if (convError || !conversation) {
        return ServiceResult.failure(new Error('Conversation not found'), 'Conversation not found');
      }

      // Can't leave if you're the creator and there are other participants
      if (conversation.created_by === userId && conversation.participant_count > 1) {
        return ServiceResult.failure(
          new Error('Creator cannot leave'),
          'As the creator, you cannot leave while others are still in the conversation'
        );
      }

      // Mark as inactive
      const { error: leaveError } = await supabaseAdmin
        .from('conversation_participants')
        .update({ is_active: false })
        .eq('conversation_id', conversation.id)
        .eq('user_id', userId);

      if (leaveError) {
        return ServiceResult.failure(leaveError, 'Failed to leave conversation');
      }

      // Update participant count
      if (conversation.participant_count > 1) {
        await supabaseAdmin
          .from('conversations')
          .update({
            participant_count: conversation.participant_count - 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id);
      } else {
        // If last participant, deactivate conversation
        await supabaseAdmin
          .from('conversations')
          .update({
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id);
      }

      // Clear cache
      conversationCache.clear();

      return ServiceResult.success({
        conversationId,
        action: 'left'
      }, 'Successfully left conversation');

    } catch (error) {
      console.error('Leave conversation service error:', error);
      return ServiceResult.failure(error, 'Failed to leave conversation');
    }
  }

  /**
   * Search users by avatar name or email
   * @param {string} query - Search query
   * @param {string} currentUserId - Current user ID (to exclude from results)
   * @param {Object} options - Search options
   * @returns {ServiceResult}
   */
  async searchUsers(query, currentUserId, options = {}) {
    try {
      const { limit = 20, includeInactive = false } = options;

      if (!query || query.trim().length < 2) {
        return ServiceResult.failure(new Error('Query too short'), 'Search query must be at least 2 characters');
      }

      let dbQuery = supabaseAdmin
        .from('users')
        .select(`
          id,
          avatar_name,
          email,
          is_active,
          created_at,
          user_profiles (
            display_name,
            status,
            last_seen
          )
        `)
        .neq('id', currentUserId)
        .ilike('avatar_name', `%${query}%`)
        .order('avatar_name');

      if (!includeInactive) {
        dbQuery = dbQuery.eq('is_active', true);
      }

      const { data, error } = await dbQuery.limit(limit);

      if (error) {
        console.error('User search error:', error);
        return ServiceResult.failure(error, 'Failed to search users');
      }

      return ServiceResult.success({
        users: data,
        query,
        count: data.length
      }, 'User search completed successfully');

    } catch (error) {
      console.error('Search users service error:', error);
      return ServiceResult.failure(error, 'Failed to search users');
    }
  }

  /**
   * Generate unique conversation ID
   * @returns {string} Conversation ID
   */
  generateConversationId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `conv_${timestamp}_${random}`;
  }

  /**
   * Get user statistics
   * @param {string} userId - User ID
   * @returns {ServiceResult}
   */
  async getUserStats(userId) {
    try {
      // Get conversation count
      const { count: conversationCount } = await supabaseAdmin
        .from('conversation_participants')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_active', true);

      // Get message count (from metadata)
      const { count: messageCount } = await supabaseAdmin
        .from('message_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', userId);

      // Get account age
      const { data: user } = await supabaseAdmin
        .from('users')
        .select('created_at')
        .eq('id', userId)
        .single();

      const accountAge = user ? Math.floor((Date.now() - new Date(user.created_at)) / (1000 * 60 * 60 * 24)) : 0;

      return ServiceResult.success({
        stats: {
          conversations: conversationCount || 0,
          messages: messageCount || 0,
          accountAge,
          averageMessagesPerDay: accountAge > 0 ? Math.round((messageCount || 0) / accountAge) : 0
        }
      }, 'User statistics retrieved successfully');

    } catch (error) {
      console.error('Get user stats service error:', error);
      return ServiceResult.failure(error, 'Failed to get user statistics');
    }
  }
}

module.exports = new ProfileService();
