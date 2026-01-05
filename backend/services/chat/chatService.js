const { supabaseAdmin } = require('../../config/supabase');
const { conversationCache } = require('../../shared/utils/cache');
const { ServiceResult } = require('../../shared/utils/response');

class ChatService {
  /**
   * Record message metadata (content stays local)
   * @param {Object} messageData - Message metadata
   * @returns {ServiceResult}
   */
  async recordMessageMetadata(messageData) {
    try {
      const {
        conversationId,
        senderId,
        messageType = 'text',
        localMessageId,
        contentHash,
        metadata = {}
      } = messageData;

      // Verify conversation exists and user is participant
      const { data: participant, error: partError } = await supabaseAdmin
        .from('conversation_participants')
        .select(`
          conversations!inner(id, conversation_id, is_active),
          role,
          is_active
        `)
        .eq('user_id', senderId)
        .eq('conversation_id', conversationId)
        .eq('is_active', true)
        .single();

      if (partError || !participant) {
        return ServiceResult.failure(
          new Error('Not authorized'),
          'User is not a participant in this conversation'
        );
      }

      if (!participant.conversations.is_active) {
        return ServiceResult.failure(
          new Error('Conversation inactive'),
          'Conversation is no longer active'
        );
      }

      // Insert message metadata
      const { data: messageMeta, error: metaError } = await supabaseAdmin
        .from('message_metadata')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          message_type: messageType,
          local_message_id: localMessageId,
          content_hash: contentHash,
          metadata: metadata
        })
        .select()
        .single();

      if (metaError) {
        console.error('Message metadata recording error:', metaError);
        return ServiceResult.failure(metaError, 'Failed to record message metadata');
      }

      // Update conversation last_message_at
      await supabaseAdmin
        .from('conversations')
        .update({
          last_message_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', participant.conversations.id);

      // Clear conversation cache
      conversationCache.clear();

      return ServiceResult.success({
        messageMetadata: messageMeta
      }, 'Message metadata recorded successfully');

    } catch (error) {
      console.error('Record message metadata service error:', error);
      return ServiceResult.failure(error, 'Failed to record message metadata');
    }
  }

  /**
   * Get conversation messages metadata
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (to verify access)
   * @param {Object} options - Query options
   * @returns {ServiceResult}
   */
  async getConversationMessages(conversationId, userId, options = {}) {
    try {
      const { limit = 50, offset = 0, beforeTimestamp, afterTimestamp } = options;

      // Verify user has access to conversation
      const { data: participant, error: accessError } = await supabaseAdmin
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (accessError || !participant) {
        return ServiceResult.failure(
          new Error('Access denied'),
          'You do not have access to this conversation'
        );
      }

      // Build query
      let query = supabaseAdmin
        .from('message_metadata')
        .select(`
          *,
          users:sender_id (
            id,
            avatar_name
          )
        `)
        .eq('conversation_id', conversationId)
        .order('timestamp', { ascending: false })
        .range(offset, offset + limit - 1);

      if (beforeTimestamp) {
        query = query.lt('timestamp', beforeTimestamp);
      }

      if (afterTimestamp) {
        query = query.gt('timestamp', afterTimestamp);
      }

      const { data: messages, error } = await query;

      if (error) {
        console.error('Get messages error:', error);
        return ServiceResult.failure(error, 'Failed to get messages');
      }

      return ServiceResult.success({
        messages: messages.reverse(), // Return in chronological order
        pagination: {
          limit,
          offset,
          hasMore: messages.length === limit,
          count: messages.length
        }
      }, 'Messages retrieved successfully');

    } catch (error) {
      console.error('Get conversation messages service error:', error);
      return ServiceResult.failure(error, 'Failed to get conversation messages');
    }
  }

  /**
   * Mark messages as read
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID
   * @param {string} lastReadMessageId - Last read message ID
   * @returns {ServiceResult}
   */
  async markMessagesRead(conversationId, userId, lastReadMessageId) {
    try {
      // Verify user has access
      const { data: participant, error: accessError } = await supabaseAdmin
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (accessError || !participant) {
        return ServiceResult.failure(
          new Error('Access denied'),
          'You do not have access to this conversation'
        );
      }

      // Update last read timestamp
      const { error: updateError } = await supabaseAdmin
        .from('conversation_participants')
        .update({
          last_read_at: new Date().toISOString()
        })
        .eq('id', participant.id);

      if (updateError) {
        console.error('Mark read error:', updateError);
        return ServiceResult.failure(updateError, 'Failed to mark messages as read');
      }

      return ServiceResult.success({
        conversationId,
        lastReadAt: new Date().toISOString()
      }, 'Messages marked as read');

    } catch (error) {
      console.error('Mark messages read service error:', error);
      return ServiceResult.failure(error, 'Failed to mark messages as read');
    }
  }

  /**
   * Get conversation details
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (to verify access)
   * @returns {ServiceResult}
   */
  async getConversationDetails(conversationId, userId) {
    try {
      // Get conversation with participant info
      const { data: conversation, error } = await supabaseAdmin
        .from('conversations')
        .select(`
          *,
          conversation_participants!inner (
            user_id,
            role,
            joined_at,
            last_read_at,
            is_active,
            users (
              id,
              avatar_name,
              user_profiles (
                display_name,
                status,
                last_seen
              )
            )
          )
        `)
        .eq('conversation_id', conversationId)
        .eq('conversation_participants.user_id', userId)
        .eq('conversation_participants.is_active', true)
        .single();

      if (error || !conversation) {
        return ServiceResult.failure(
          new Error('Not found'),
          'Conversation not found or access denied'
        );
      }

      // Get message count
      const { count: messageCount } = await supabaseAdmin
        .from('message_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversation.id);

      // Format participants
      const participants = conversation.conversation_participants.map(part => ({
        userId: part.user_id,
        avatarName: part.users.avatar_name,
        displayName: part.users.user_profiles?.display_name || part.users.avatar_name,
        status: part.users.user_profiles?.status || 'offline',
        lastSeen: part.users.user_profiles?.last_seen,
        role: part.role,
        joinedAt: part.joined_at,
        lastReadAt: part.last_read_at,
        isActive: part.is_active
      }));

      const conversationDetails = {
        id: conversation.id,
        conversationId: conversation.conversation_id,
        title: conversation.title,
        description: conversation.description,
        createdBy: conversation.created_by,
        participantCount: conversation.participant_count,
        lastMessageAt: conversation.last_message_at,
        isActive: conversation.is_active,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
        participants,
        messageCount: messageCount || 0,
        userRole: conversation.conversation_participants[0]?.role
      };

      return ServiceResult.success({
        conversation: conversationDetails
      }, 'Conversation details retrieved successfully');

    } catch (error) {
      console.error('Get conversation details service error:', error);
      return ServiceResult.failure(error, 'Failed to get conversation details');
    }
  }

  /**
   * Update conversation settings
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (must be admin)
   * @param {Object} updates - Updates to apply
   * @returns {ServiceResult}
   */
  async updateConversation(conversationId, userId, updates) {
    try {
      // Check if user is admin
      const { data: participant, error: roleError } = await supabaseAdmin
        .from('conversation_participants')
        .select('role, conversations!inner(id)')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (roleError || !participant || participant.role !== 'admin') {
        return ServiceResult.failure(
          new Error('Permission denied'),
          'Only conversation admins can update settings'
        );
      }

      const allowedFields = ['title', 'description'];
      const filteredUpdates = {};

      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key)) {
          if (key === 'title' && updates[key]) {
            if (updates[key].length > 255) {
              throw new Error('Title must be less than 255 characters');
            }
            filteredUpdates[key] = updates[key].trim();
          } else if (key === 'description') {
            filteredUpdates[key] = updates[key]?.trim();
          }
        }
      });

      if (Object.keys(filteredUpdates).length === 0) {
        return ServiceResult.failure(new Error('No valid updates'), 'No valid fields to update');
      }

      filteredUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabaseAdmin
        .from('conversations')
        .update(filteredUpdates)
        .eq('id', participant.conversations.id)
        .select()
        .single();

      if (error) {
        console.error('Conversation update error:', error);
        return ServiceResult.failure(error, 'Failed to update conversation');
      }

      // Clear cache
      conversationCache.clear();

      return ServiceResult.success({
        conversation: data
      }, 'Conversation updated successfully');

    } catch (error) {
      console.error('Update conversation service error:', error);
      return ServiceResult.failure(error, 'Failed to update conversation');
    }
  }

  /**
   * Get user's unread message counts
   * @param {string} userId - User ID
   * @returns {ServiceResult}
   */
  async getUnreadCounts(userId) {
    try {
      // Get all conversations user participates in
      const { data: conversations, error } = await supabaseAdmin
        .from('conversation_participants')
        .select(`
          conversation_id,
          last_read_at,
          conversations!inner (
            id,
            conversation_id,
            last_message_at
          )
        `)
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) {
        console.error('Get unread counts error:', error);
        return ServiceResult.failure(error, 'Failed to get unread counts');
      }

      const unreadCounts = {};

      for (const conv of conversations) {
        const conversationId = conv.conversations.conversation_id;
        const lastReadAt = conv.last_read_at;
        const lastMessageAt = conv.conversations.last_message_at;

        if (!lastMessageAt) {
          unreadCounts[conversationId] = 0;
          continue;
        }

        if (!lastReadAt || new Date(lastMessageAt) > new Date(lastReadAt)) {
          // Count unread messages
          const { count } = await supabaseAdmin
            .from('message_metadata')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.conversation_id)
            .gt('timestamp', lastReadAt || '1970-01-01T00:00:00Z');

          unreadCounts[conversationId] = count || 0;
        } else {
          unreadCounts[conversationId] = 0;
        }
      }

      const totalUnread = Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);

      return ServiceResult.success({
        unreadCounts,
        totalUnread
      }, 'Unread counts retrieved successfully');

    } catch (error) {
      console.error('Get unread counts service error:', error);
      return ServiceResult.failure(error, 'Failed to get unread counts');
    }
  }

  /**
   * Delete message metadata (for message deletion)
   * @param {string} messageId - Local message ID
   * @param {string} userId - User ID (must be sender)
   * @returns {ServiceResult}
   */
  async deleteMessageMetadata(messageId, userId) {
    try {
      const { error } = await supabaseAdmin
        .from('message_metadata')
        .delete()
        .eq('local_message_id', messageId)
        .eq('sender_id', userId);

      if (error) {
        console.error('Delete message metadata error:', error);
        return ServiceResult.failure(error, 'Failed to delete message metadata');
      }

      return ServiceResult.success({
        messageId
      }, 'Message metadata deleted successfully');

    } catch (error) {
      console.error('Delete message metadata service error:', error);
      return ServiceResult.failure(error, 'Failed to delete message metadata');
    }
  }

  /**
   * Get conversation activity summary
   * @param {string} conversationId - Conversation ID
   * @param {string} userId - User ID (to verify access)
   * @param {number} days - Number of days to look back
   * @returns {ServiceResult}
   */
  async getConversationActivity(conversationId, userId, days = 7) {
    try {
      // Verify access
      const { data: participant, error: accessError } = await supabaseAdmin
        .from('conversation_participants')
        .select('id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (accessError || !participant) {
        return ServiceResult.failure(
          new Error('Access denied'),
          'You do not have access to this conversation'
        );
      }

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      // Get message count for period
      const { count: messageCount } = await supabaseAdmin
        .from('message_metadata')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .gte('timestamp', startDate.toISOString());

      // Get active participants count
      const { count: activeParticipants } = await supabaseAdmin
        .from('conversation_participants')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId)
        .eq('is_active', true);

      return ServiceResult.success({
        activity: {
          periodDays: days,
          messageCount: messageCount || 0,
          activeParticipants: activeParticipants || 0,
          messagesPerDay: Math.round((messageCount || 0) / days),
          startDate: startDate.toISOString()
        }
      }, 'Conversation activity retrieved successfully');

    } catch (error) {
      console.error('Get conversation activity service error:', error);
      return ServiceResult.failure(error, 'Failed to get conversation activity');
    }
  }
}

module.exports = new ChatService();
