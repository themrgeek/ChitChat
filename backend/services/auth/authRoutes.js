const express = require('express');
const router = express.Router();
const authService = require('./authService');
const { authenticateSession, rateLimitAuth } = require('../../shared/middleware/auth');
const { APIResponse } = require('../../shared/utils/response');

// Apply rate limiting to auth endpoints
router.use(rateLimitAuth);

/**
 * POST /api/auth/send-otp
 * Send OTP to email for user registration
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return APIResponse.send(res, APIResponse.error('Email is required', 400));
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return APIResponse.send(res, APIResponse.error('Invalid email format', 400));
    }

    // Create OTP verification and send email
    const result = await authService.createOTPVerification(email, 'registration');

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 500));
    }

    // Email is sent by authService.createOTPVerification()
    // For development, include OTP in response
    const response = result.data.otpRecord;

    // In production, don't include OTP in response
    const isProduction = process.env.NODE_ENV === 'production';
    if (isProduction) {
      delete response.otp;
      delete response.tempPassword;
    }

    APIResponse.send(res, APIResponse.success({
      message: 'OTP sent successfully',
      avatarName: response.avatarName,
      emailStatus: 'queued',
      estimatedDelivery: '10-30 seconds',
      ...(isProduction ? {} : {
        otp: response.otp,
        tempPassword: response.tempPassword
      })
    }));

  } catch (error) {
    console.error('Send OTP route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to send OTP', 500));
  }
});

/**
 * POST /api/auth/verify-otp
 * Verify OTP and create user account
 */
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return APIResponse.send(res, APIResponse.error('Email and OTP are required', 400));
    }

    // Verify OTP
    const otpResult = await authService.verifyOTP(email, otp, 'registration');

    if (!otpResult.success) {
      return APIResponse.send(res, APIResponse.error(otpResult.message, 400));
    }

    const { avatarName, tempPassword } = otpResult.data.otpRecord;

    // Create user account
    const userResult = await authService.createUser({
      email,
      avatarName,
      tempPassword,
      etherealUser: process.env.ETHEREAL_USER,
      etherealPass: process.env.ETHEREAL_PASS
    });

    if (!userResult.success) {
      return APIResponse.send(res, APIResponse.error(userResult.message, 400));
    }

    // Create session
    const sessionResult = await authService.createSession(userResult.data.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
    });

    if (!sessionResult.success) {
      console.error('Session creation failed:', sessionResult.error);
      // Don't fail the registration, but log the error
    }

    const response = {
      message: 'Account created successfully!',
      user: {
        id: userResult.data.user.id,
        email: userResult.data.user.email,
        avatarName: userResult.data.user.avatarName
      },
      etherealCredentials: {
        email: `${process.env.ETHEREAL_USER}@ethereal.email`,
        password: process.env.ETHEREAL_PASS
      }
    };

    // Include session if created successfully
    if (sessionResult.success) {
      response.session = {
        token: sessionResult.data.session.token,
        expiresAt: sessionResult.data.session.expiresAt
      };
    }

    APIResponse.send(res, APIResponse.success(response));

  } catch (error) {
    console.error('Verify OTP route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to verify OTP', 500));
  }
});

/**
 * POST /api/auth/login
 * Authenticate user with avatar name and password
 */
router.post('/login', async (req, res) => {
  try {
    const { avatarName, password } = req.body;

    if (!avatarName || !password) {
      return APIResponse.send(res, APIResponse.error('Avatar name and password are required', 400));
    }

    // Authenticate user
    const authResult = await authService.authenticateUser(avatarName, password);

    if (!authResult.success) {
      return APIResponse.send(res, APIResponse.error(authResult.message, 401));
    }

    // Create session
    const sessionResult = await authService.createSession(authResult.data.user.id, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
    });

    if (!sessionResult.success) {
      return APIResponse.send(res, APIResponse.error('Failed to create session', 500));
    }

    APIResponse.send(res, APIResponse.success({
      message: 'Login successful!',
      user: authResult.data.user,
      session: {
        token: sessionResult.data.session.token,
        expiresAt: sessionResult.data.session.expiresAt
      }
    }));

  } catch (error) {
    console.error('Login route error:', error);
    APIResponse.send(res, APIResponse.error('Login failed', 500));
  }
});

/**
 * POST /api/auth/logout
 * Logout user and invalidate session
 */
router.post('/logout', authenticateSession, async (req, res) => {
  try {
    const result = await authService.logout(req.session.token);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 500));
    }

    APIResponse.send(res, APIResponse.success({
      message: 'Logged out successfully'
    }));

  } catch (error) {
    console.error('Logout route error:', error);
    APIResponse.send(res, APIResponse.error('Logout failed', 500));
  }
});

/**
 * GET /api/auth/validate-session
 * Validate current session
 */
router.get('/validate-session', authenticateSession, async (req, res) => {
  APIResponse.send(res, APIResponse.success({
    message: 'Session is valid',
    user: req.user,
    session: req.session
  }));
});

/**
 * GET /api/auth/user/:userId
 * Get user information (protected route)
 */
router.get('/user/:userId', authenticateSession, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await authService.getUserById(userId);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.notFound('User'));
    }

    APIResponse.send(res, APIResponse.success({
      user: result.data.user
    }));

  } catch (error) {
    console.error('Get user route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to get user', 500));
  }
});

/**
 * POST /api/auth/cleanup
 * Clean up expired sessions and OTPs (admin endpoint)
 */
router.post('/cleanup', authenticateSession, async (req, res) => {
  try {
    // TODO: Add admin role check
    const result = await authService.cleanupExpiredData();

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error(result.message, 500));
    }

    APIResponse.send(res, APIResponse.success({
      message: 'Cleanup completed',
      data: result.data
    }));

  } catch (error) {
    console.error('Cleanup route error:', error);
    APIResponse.send(res, APIResponse.error('Cleanup failed', 500));
  }
});

module.exports = router;
