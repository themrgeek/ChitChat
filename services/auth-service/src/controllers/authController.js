const { supabase } = require('../../../shared/config/supabase');
const jwtManager = require('../../../shared/utils/jwt');
const crypto = require('crypto');

class AuthController {
  // Generate secure OTP
  generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Generate unique avatar name
  generateAvatarName() {
    const adjectives = ['Mystic', 'Shadow', 'Cosmic', 'Digital', 'Cyber', 'Phantom', 'Quantum', 'Void', 'Neon', 'Echo'];
    const nouns = ['Wolf', 'Eagle', 'Tiger', 'Phoenix', 'Dragon', 'Raven', 'Lynx', 'Falcon', 'Bear', 'Snake'];
    const numbers = Math.floor(Math.random() * 9999);

    return `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${numbers}`;
  }

  // Generate temporary password
  generateTempPassword() {
    return crypto.randomBytes(12).toString('hex');
  }

  // Send OTP - Step 1: Request account creation
  async sendOTP(req, res) {
    const requestStart = Date.now();

    try {
      const { email } = req.body;

      // Validate input
      if (!email) {
        return res.status(400).json({
          error: 'Email is required',
          code: 'EMAIL_REQUIRED'
        });
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          error: 'Invalid email format',
          code: 'INVALID_EMAIL'
        });
      }

      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('id, email_verified')
        .eq('email', email)
        .single();

      if (existingUser && existingUser.email_verified) {
        return res.status(409).json({
          error: 'Account already exists with this email',
          code: 'ACCOUNT_EXISTS'
        });
      }

      // Generate secure credentials
      const otp = this.generateOTP();
      const avatarName = this.generateAvatarName();
      const tempPassword = this.generateTempPassword();

      // Store OTP in database (expires in 5 minutes)
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

      const { data: otpRecord, error: otpError } = await supabase
        .from('otp_verifications')
        .insert({
          email,
          otp_code: otp,
          avatar_name: avatarName,
          temp_password: tempPassword,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (otpError) {
        console.error('OTP storage error:', otpError);
        return res.status(500).json({
          error: 'Failed to process OTP request',
          code: 'OTP_STORAGE_FAILED'
        });
      }

      // Queue email (background processing)
      this.queueEmailJob(email, otp, avatarName, tempPassword);

      const responseTime = Date.now() - requestStart;

      res.json({
        message: 'OTP sent successfully! Check your email.',
        avatarName,
        emailStatus: 'queued',
        estimatedDelivery: '10-30 seconds',
        responseTime: `${responseTime}ms`,
        expiresIn: 300 // 5 minutes
      });

    } catch (error) {
      console.error('Send OTP error:', error);
      const responseTime = Date.now() - requestStart;
      res.status(500).json({
        error: 'Failed to send OTP',
        code: 'INTERNAL_ERROR',
        responseTime: `${responseTime}ms`
      });
    }
  }

  // Verify OTP and create account - Step 2
  async verifyOTP(req, res) {
    const requestStart = Date.now();

    try {
      const { email, otp } = req.body;

      // Validate input
      if (!email || !otp) {
        return res.status(400).json({
          error: 'Email and OTP are required',
          code: 'MISSING_CREDENTIALS'
        });
      }

      // Find valid OTP
      const { data: otpRecord, error: otpError } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('email', email)
        .eq('otp_code', otp)
        .eq('used', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (otpError || !otpRecord) {
        return res.status(400).json({
          error: 'Invalid or expired OTP',
          code: 'INVALID_OTP'
        });
      }

      // Create user account
      const { data: user, error: userError } = await supabase
        .from('users')
        .insert({
          email,
          avatar_name: otpRecord.avatar_name,
          temp_password: otpRecord.temp_password,
          ethereal_user: process.env.ETHEREAL_USER,
          ethereal_pass: process.env.ETHEREAL_PASS,
          email_verified: true,
          last_login: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) {
        console.error('User creation error:', userError);
        return res.status(500).json({
          error: 'Failed to create account',
          code: 'ACCOUNT_CREATION_FAILED'
        });
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: user.id,
          display_name: otpRecord.avatar_name,
          is_online: true,
          last_seen: new Date().toISOString(),
          preferences: {
            theme: 'dark',
            notifications: true,
            soundEnabled: true
          }
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
        // Don't fail the whole request for profile creation
      }

      // Create session
      const tokenPair = jwtManager.generateTokenPair(user.id);
      const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          session_token: tokenPair.sessionId, // Store session ID, not the JWT
          expires_at: sessionExpires.toISOString(),
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          is_active: true
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        return res.status(500).json({
          error: 'Failed to create session',
          code: 'SESSION_CREATION_FAILED'
        });
      }

      // Mark OTP as used
      await supabase
        .from('otp_verifications')
        .update({ used: true })
        .eq('id', otpRecord.id);

      // Queue credentials email
      this.queueCredentialsEmail(user, otpRecord.temp_password);

      const responseTime = Date.now() - requestStart;

      res.json({
        message: 'Account created successfully!',
        user: {
          id: user.id,
          email: user.email,
          avatarName: user.avatar_name,
          tempPassword: user.temp_password
        },
        session: {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          expiresAt: sessionExpires
        },
        etherealCredentials: {
          email: `${process.env.ETHEREAL_USER}@ethereal.email`,
          password: process.env.ETHEREAL_PASS
        },
        responseTime: `${responseTime}ms`
      });

    } catch (error) {
      console.error('Verify OTP error:', error);
      const responseTime = Date.now() - requestStart;
      res.status(500).json({
        error: 'Verification failed',
        code: 'INTERNAL_ERROR',
        responseTime: `${responseTime}ms`
      });
    }
  }

  // Login with avatar name and password
  async login(req, res) {
    const requestStart = Date.now();

    try {
      const { avatarName, password } = req.body;

      // Validate input
      if (!avatarName || !password) {
        return res.status(400).json({
          error: 'Avatar name and password are required',
          code: 'MISSING_CREDENTIALS'
        });
      }

      // Find user
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('avatar_name', avatarName)
        .eq('temp_password', password)
        .single();

      if (userError || !user) {
        return res.status(401).json({
          error: 'Invalid credentials',
          code: 'INVALID_CREDENTIALS'
        });
      }

      // Check if account is active
      if (!user.is_active) {
        return res.status(403).json({
          error: 'Account is deactivated',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Update last login
      await supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', user.id);

      // Create session
      const tokenPair = jwtManager.generateTokenPair(user.id);
      const sessionExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          user_id: user.id,
          session_token: tokenPair.sessionId,
          expires_at: sessionExpires.toISOString(),
          ip_address: req.ip,
          user_agent: req.headers['user-agent'],
          is_active: true
        });

      if (sessionError) {
        console.error('Session creation error:', sessionError);
        return res.status(500).json({
          error: 'Login failed',
          code: 'SESSION_CREATION_FAILED'
        });
      }

      // Update profile online status
      await supabase
        .from('user_profiles')
        .update({
          is_online: true,
          last_seen: new Date().toISOString()
        })
        .eq('user_id', user.id);

      const responseTime = Date.now() - requestStart;

      res.json({
        message: 'Login successful!',
        user: {
          id: user.id,
          email: user.email,
          avatarName: user.avatar_name
        },
        session: {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          expiresAt: sessionExpires
        },
        responseTime: `${responseTime}ms`
      });

    } catch (error) {
      console.error('Login error:', error);
      const responseTime = Date.now() - requestStart;
      res.status(500).json({
        error: 'Login failed',
        code: 'INTERNAL_ERROR',
        responseTime: `${responseTime}ms`
      });
    }
  }

  // Refresh access token
  async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: 'Refresh token is required',
          code: 'REFRESH_TOKEN_REQUIRED'
        });
      }

      // Verify refresh token and get new access token
      const newAccessToken = jwtManager.refreshAccessToken(refreshToken);

      // Decode to get user ID and session ID
      const decoded = jwtManager.verifyRefreshToken(refreshToken);

      // Verify session still exists
      const { data: session } = await supabase
        .from('sessions')
        .select('id, is_active')
        .eq('session_token', decoded.sessionId)
        .eq('is_active', true)
        .single();

      if (!session) {
        return res.status(401).json({
          error: 'Session expired',
          code: 'SESSION_EXPIRED'
        });
      }

      res.json({
        accessToken: newAccessToken,
        tokenType: 'Bearer'
      });

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(401).json({
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN'
      });
    }
  }

  // Logout
  async logout(req, res) {
    try {
      // Invalidate current session
      await supabase
        .from('sessions')
        .update({ is_active: false })
        .eq('session_token', req.session.token);

      // Update profile offline status
      await supabase
        .from('user_profiles')
        .update({
          is_online: false,
          last_seen: new Date().toISOString()
        })
        .eq('user_id', req.user.id);

      res.json({
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        error: 'Logout failed',
        code: 'LOGOUT_FAILED'
      });
    }
  }

  // Get current user info
  async getCurrentUser(req, res) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          avatar_name,
          created_at,
          last_login,
          email_verified,
          user_profiles (
            display_name,
            bio,
            avatar_url,
            is_online,
            last_seen,
            preferences
          )
        `)
        .eq('id', req.user.id)
        .single();

      if (error) {
        return res.status(404).json({
          error: 'User not found',
          code: 'USER_NOT_FOUND'
        });
      }

      res.json({ user });

    } catch (error) {
      console.error('Get current user error:', error);
      res.status(500).json({
        error: 'Failed to get user info',
        code: 'INTERNAL_ERROR'
      });
    }
  }

  // Background email processing (simplified)
  queueEmailJob(email, otp, avatarName, tempPassword) {
    // Use a simple setImmediate for background processing
    // In production, you'd use a proper job queue like Bull or Redis
    setImmediate(async () => {
      try {
        const emailService = require('../utils/emailService');
        await emailService.sendOTPEmail(email, otp, avatarName, tempPassword);
        console.log(`✅ OTP email sent to ${email}`);
      } catch (error) {
        console.error(`❌ Failed to send OTP email to ${email}:`, error.message);
      }
    });
  }

  queueCredentialsEmail(user, tempPassword) {
    setImmediate(async () => {
      try {
        const emailService = require('../utils/emailService');
        await emailService.sendCredentialsEmail(
          user.email,
          user.avatar_name,
          tempPassword,
          user.ethereal_pass
        );
        console.log(`✅ Credentials email sent to ${user.email}`);
      } catch (error) {
        console.error(`❌ Failed to send credentials email to ${user.email}:`, error.message);
      }
    });
  }
}

module.exports = new AuthController();
