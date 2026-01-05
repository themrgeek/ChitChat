const { supabaseAdmin } = require('../../src/config/supabase');
const jwtUtils = require('../../shared/utils/jwt');
const { userCache, sessionCache } = require('../../shared/utils/cache');
const { ServiceResult } = require('../../shared/utils/response');
const emailService = require('../email/emailService');
const crypto = require('crypto');

class AuthService {
  /**
   * Generate a secure OTP
   * @returns {string} 6-digit OTP
   */
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate a unique avatar name
   * @returns {string} Avatar name
   */
  generateAvatarName() {
    const adjectives = ['Mystic', 'Shadow', 'Cosmic', 'Digital', 'Cyber', 'Phantom', 'Quantum', 'Void', 'Neon', 'Dark'];
    const nouns = ['Wolf', 'Eagle', 'Tiger', 'Phoenix', 'Dragon', 'Raven', 'Lynx', 'Falcon', 'Bear', 'Owl'];
    const number = Math.floor(Math.random() * 9999) + 1000;
    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${number}`;
  }

  /**
   * Generate a temporary password
   * @returns {string} Secure temporary password
   */
  generateTempPassword() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Create OTP verification record
   * @param {string} email - User email
   * @param {string} purpose - OTP purpose (registration, login, password_reset)
   * @returns {ServiceResult}
   */
  async createOTPVerification(email, purpose = 'registration') {
    try {
      const otp = this.generateOTP();
      const avatarName = this.generateAvatarName();
      const tempPassword = this.generateTempPassword();
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const { data: otpRecord, error } = await supabaseAdmin
        .from('otp_verifications')
        .insert({
          email,
          otp_code: otp,
          avatar_name: avatarName,
          temp_password: tempPassword,
          purpose,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('OTP creation error:', error);
        return ServiceResult.failure(error, 'Failed to create OTP verification');
      }

      // Actually send the OTP email
      try {
        console.log(`📧 Sending OTP email to: ${email}`);
        const emailResult = await emailService.sendOTPEmail(
          email,
          otp,
          avatarName,
          tempPassword
        );

        if (!emailResult.success) {
          console.error('❌ OTP Email sending failed:', emailResult);
          // Continue anyway - OTP is stored in database, user can still proceed
          // In production, you might want to retry or notify admin
        } else {
          console.log('✅ OTP email sent successfully');
        }
      } catch (emailError) {
        console.error('❌ Email service error:', emailError);
        // Continue anyway - don't fail registration for email issues
      }

      return ServiceResult.success({
        otpRecord: {
          id: otpRecord.id,
          email: otpRecord.email,
          otp: otpRecord.otp_code,
          avatarName: otpRecord.avatar_name,
          tempPassword: otpRecord.temp_password,
          expiresAt: otpRecord.expires_at
        }
      }, 'OTP verification created successfully');

    } catch (error) {
      console.error('OTP creation service error:', error);
      return ServiceResult.failure(error, 'OTP service error');
    }
  }

  /**
   * Verify OTP and return verification data
   * @param {string} email - User email
   * @param {string} otp - OTP code
   * @param {string} purpose - Expected purpose
   * @returns {ServiceResult}
   */
  async verifyOTP(email, otp, purpose = null) {
    try {
      const { data: otpRecord, error } = await supabaseAdmin
        .from('otp_verifications')
        .select('*')
        .eq('email', email)
        .eq('otp_code', otp)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !otpRecord) {
        return ServiceResult.failure(
          new Error('Invalid or expired OTP'),
          'OTP verification failed'
        );
      }

      if (purpose && otpRecord.purpose !== purpose) {
        return ServiceResult.failure(
          new Error('OTP purpose mismatch'),
          'Invalid OTP for this operation'
        );
      }

      // Mark OTP as used
      await supabaseAdmin
        .from('otp_verifications')
        .update({ used: true, used_at: new Date().toISOString() })
        .eq('id', otpRecord.id);

      return ServiceResult.success({
        otpRecord: {
          id: otpRecord.id,
          email: otpRecord.email,
          avatarName: otpRecord.avatar_name,
          tempPassword: otpRecord.temp_password,
          purpose: otpRecord.purpose
        }
      }, 'OTP verified successfully');

    } catch (error) {
      console.error('OTP verification service error:', error);
      return ServiceResult.failure(error, 'OTP verification service error');
    }
  }

  /**
   * Create new user account
   * @param {Object} userData - User data
   * @returns {ServiceResult}
   */
  async createUser(userData) {
    try {
      const { email, avatarName, tempPassword, etherealUser, etherealPass } = userData;

      // Check if user already exists
      const { data: existingUser } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        return ServiceResult.failure(
          new Error('User already exists'),
          'Account already exists with this email'
        );
      }

      // Check if avatar name is taken
      const { data: existingAvatar } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('avatar_name', avatarName)
        .single();

      if (existingAvatar) {
        return ServiceResult.failure(
          new Error('Avatar name taken'),
          'Avatar name is already taken'
        );
      }

      // Create user
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .insert({
          email,
          avatar_name: avatarName,
          temp_password: tempPassword,
          email_verified: true
        })
        .select()
        .single();

      if (userError) {
        console.error('User creation error:', userError);
        return ServiceResult.failure(userError, 'Failed to create user account');
      }

      // Create user profile
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .insert({
          user_id: user.id,
          display_name: avatarName,
          status: 'online',
          last_seen: new Date().toISOString()
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Don't fail the whole operation for profile creation
      }

        // Send credentials email
      try {
        console.log(`📧 Sending credentials email to: ${email}`);
        const credentialsEmailResult = await emailService.sendCredentialsEmail(
          email,
          avatarName,
          tempPassword,
          null // No longer using Ethereal
        );

        if (!credentialsEmailResult.success) {
          console.error('❌ Credentials email sending failed:', credentialsEmailResult);
          // Continue anyway - user account is created
        } else {
          console.log('✅ Credentials email sent successfully');
        }
      } catch (emailError) {
        console.error('❌ Credentials email service error:', emailError);
        // Continue anyway - don't fail user creation for email issues
      }

      // Clear user cache
      userCache.delete(`user:email:${email}`);
      userCache.delete(`user:avatar:${avatarName}`);

      return ServiceResult.success({
        user: {
          id: user.id,
          email: user.email,
          avatarName: user.avatar_name,
          tempPassword: user.temp_password,
          createdAt: user.created_at
        }
      }, 'User account created successfully');

    } catch (error) {
      console.error('User creation service error:', error);
      return ServiceResult.failure(error, 'User creation service error');
    }
  }

  /**
   * Authenticate user login
   * @param {string} avatarName - User's avatar name
   * @param {string} password - User's password
   * @returns {ServiceResult}
   */
  async authenticateUser(avatarName, password) {
    try {
      // Find user
      const { data: user, error: userError } = await supabaseAdmin
        .from('users')
        .select(`
          *,
          user_profiles (*)
        `)
        .eq('avatar_name', avatarName)
        .eq('temp_password', password)
        .single();

      if (userError || !user) {
        return ServiceResult.failure(
          new Error('Invalid credentials'),
          'Invalid avatar name or password'
        );
      }

      if (!user.is_active) {
        return ServiceResult.failure(
          new Error('Account deactivated'),
          'Account has been deactivated'
        );
      }

      // Update last login
      await supabaseAdmin
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      return ServiceResult.success({
        user: {
          id: user.id,
          email: user.email,
          avatarName: user.avatar_name,
          emailVerified: user.email_verified,
          lastLogin: user.last_login,
          createdAt: user.created_at,
          profile: user.user_profiles
        }
      }, 'Authentication successful');

    } catch (error) {
      console.error('User authentication service error:', error);
      return ServiceResult.failure(error, 'Authentication service error');
    }
  }

  /**
   * Create user session
   * @param {string} userId - User ID
   * @param {Object} deviceInfo - Device information
   * @returns {ServiceResult}
   */
  async createSession(userId, deviceInfo = {}) {
    try {
      const sessionToken = jwtUtils.generateSessionToken(userId);
      const expiresAt = jwtUtils.getTokenExpiration(sessionToken);

      const { data: session, error } = await supabaseAdmin
        .from('sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          device_info: deviceInfo,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Session creation error:', error);
        return ServiceResult.failure(error, 'Failed to create session');
      }

      // Cache session
      sessionCache.set(`session:${sessionToken}`, session, 900000); // 15 minutes

      return ServiceResult.success({
        session: {
          id: session.id,
          token: session.session_token,
          expiresAt: session.expires_at,
          deviceInfo: session.device_info
        }
      }, 'Session created successfully');

    } catch (error) {
      console.error('Session creation service error:', error);
      return ServiceResult.failure(error, 'Session creation service error');
    }
  }

  /**
   * Validate session token
   * @param {string} token - Session token
   * @returns {ServiceResult}
   */
  async validateSession(token) {
    try {
      // Check cache first
      let sessionData = sessionCache.get(`session:${token}`);

      if (!sessionData) {
        // Fetch from database
        const { data: session, error } = await supabaseAdmin
          .from('sessions')
          .select(`
            *,
            users:user_id (
              id,
              email,
              avatar_name,
              email_verified,
              is_active,
              created_at,
              last_login
            )
          `)
          .eq('session_token', token)
          .eq('expires_at', 'gt', new Date().toISOString())
          .single();

        if (error || !session) {
          return ServiceResult.failure(
            new Error('Session not found or expired'),
            'Invalid session'
          );
        }

        sessionData = session;
        sessionCache.set(`session:${token}`, sessionData, 900000);
      }

      return ServiceResult.success({
        session: {
          id: sessionData.id,
          user: sessionData.users,
          expiresAt: sessionData.expires_at,
          lastActivity: sessionData.last_activity
        }
      }, 'Session validated successfully');

    } catch (error) {
      console.error('Session validation service error:', error);
      return ServiceResult.failure(error, 'Session validation service error');
    }
  }

  /**
   * Logout user (invalidate session)
   * @param {string} token - Session token to invalidate
   * @returns {ServiceResult}
   */
  async logout(token) {
    try {
      const { error } = await supabaseAdmin
        .from('sessions')
        .delete()
        .eq('session_token', token);

      if (error) {
        console.error('Session deletion error:', error);
        return ServiceResult.failure(error, 'Failed to logout');
      }

      // Clear cache
      sessionCache.delete(`session:${token}`);

      return ServiceResult.success(null, 'Logged out successfully');

    } catch (error) {
      console.error('Logout service error:', error);
      return ServiceResult.failure(error, 'Logout service error');
    }
  }

  /**
   * Get user by ID with caching
   * @param {string} userId - User ID
   * @returns {ServiceResult}
   */
  async getUserById(userId) {
    try {
      const cacheKey = `user:id:${userId}`;
      let user = userCache.get(cacheKey);

      if (!user) {
        const { data, error } = await supabaseAdmin
          .from('users')
          .select(`
            *,
            user_profiles (*)
          `)
          .eq('id', userId)
          .single();

        if (error || !data) {
          return ServiceResult.failure(error || new Error('User not found'), 'User not found');
        }

        user = data;
        userCache.set(cacheKey, user, 1800000); // 30 minutes
      }

      return ServiceResult.success({ user }, 'User retrieved successfully');

    } catch (error) {
      console.error('Get user by ID service error:', error);
      return ServiceResult.failure(error, 'Failed to retrieve user');
    }
  }

  /**
   * Clean up expired sessions and OTPs
   * @returns {ServiceResult}
   */
  async cleanupExpiredData() {
    try {
      const now = new Date().toISOString();

      // Clean expired sessions
      const { data: deletedSessions, error: sessionError } = await supabaseAdmin
        .rpc('cleanup_expired_sessions');

      // Clean expired OTPs
      const { data: deletedOTPs, error: otpError } = await supabaseAdmin
        .from('otp_verifications')
        .delete()
        .lt('expires_at', now);

      if (sessionError) console.error('Session cleanup error:', sessionError);
      if (otpError) console.error('OTP cleanup error:', otpError);

      return ServiceResult.success({
        deletedSessions: deletedSessions || 0,
        deletedOTPs: deletedOTPs?.length || 0
      }, 'Cleanup completed');

    } catch (error) {
      console.error('Cleanup service error:', error);
      return ServiceResult.failure(error, 'Cleanup service error');
    }
  }
}

module.exports = new AuthService();
