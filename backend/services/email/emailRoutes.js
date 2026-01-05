const express = require('express');
const router = express.Router();
const emailService = require('./emailService');
const { authenticateSession } = require('../../shared/middleware/auth');
const { APIResponse } = require('../../shared/utils/response');

// Email routes are public for OTP delivery but protected for other operations
router.use('/send-otp', (req, res, next) => next()); // Allow public OTP sending
router.use(authenticateSession); // Require auth for other email operations

/**
 * GET /api/email/health
 * Email service health check
 */
router.get('/health', async (req, res) => {
  try {
    const health = await emailService.healthCheck();
    APIResponse.send(res, APIResponse.success(health));
  } catch (error) {
    console.error('Email health check error:', error);
    APIResponse.send(res, APIResponse.error('Health check failed', 500));
  }
});

/**
 * POST /api/email/send-otp
 * Send OTP email (public endpoint for registration)
 */
router.post('/send-otp', async (req, res) => {
  try {
    const { email, otp, avatarName, tempPassword } = req.body;

    if (!email || !otp || !avatarName) {
      return APIResponse.send(res, APIResponse.error('Email, OTP, and avatar name are required', 400));
    }

    const result = await emailService.sendOTPEmail(email, otp, avatarName, tempPassword);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error('Failed to send OTP email', 500));
    }

    APIResponse.send(res, APIResponse.success({
      message: 'OTP email sent successfully',
      messageId: result.messageId,
      previewUrl: result.previewUrl
    }));

  } catch (error) {
    console.error('Send OTP email route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to send OTP email', 500));
  }
});

/**
 * POST /api/email/send-credentials
 * Send user credentials email (protected)
 */
router.post('/send-credentials', async (req, res) => {
  try {
    const { email, avatarName, tempPassword, etherealPassword } = req.body;

    if (!email || !avatarName || !tempPassword) {
      return APIResponse.send(res, APIResponse.error('Email, avatar name, and password are required', 400));
    }

    const result = await emailService.sendCredentialsEmail(
      email,
      avatarName,
      tempPassword,
      etherealPassword
    );

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error('Failed to send credentials email', 500));
    }

    APIResponse.send(res, APIResponse.success({
      message: 'Credentials email sent successfully',
      messageId: result.messageId,
      previewUrl: result.previewUrl
    }));

  } catch (error) {
    console.error('Send credentials email route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to send credentials email', 500));
  }
});

/**
 * POST /api/email/send-login-otp
 * Send login OTP email (protected)
 */
router.post('/send-login-otp', async (req, res) => {
  try {
    const { email, otp, avatarName } = req.body;

    if (!email || !otp || !avatarName) {
      return APIResponse.send(res, APIResponse.error('Email, OTP, and avatar name are required', 400));
    }

    const result = await emailService.sendLoginOTPEmail(email, otp, avatarName);

    if (!result.success) {
      return APIResponse.send(res, APIResponse.error('Failed to send login OTP email', 500));
    }

    APIResponse.send(res, APIResponse.success({
      message: 'Login OTP email sent successfully',
      messageId: result.messageId,
      previewUrl: result.previewUrl
    }));

  } catch (error) {
    console.error('Send login OTP email route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to send login OTP email', 500));
  }
});

/**
 * POST /api/email/test
 * Send test email (admin only, for testing email service)
 */
router.post('/test', async (req, res) => {
  try {
    // TODO: Add admin role check
    const testEmail = req.body.email || req.user.email;
    const testSubject = 'ChitChat Email Test';
    const testHtml = `
      <h1>ChitChat Email Service Test</h1>
      <p>This is a test email to verify the email service is working correctly.</p>
      <p>Sent at: ${new Date().toISOString()}</p>
      <p>User: ${req.user.avatar_name}</p>
    `;

    // Create a test transporter for sending
    const nodemailer = require('nodemailer');
    const testTransporter = nodemailer.createTransporter({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: process.env.ETHEREAL_USER,
        pass: process.env.ETHEREAL_PASS
      }
    });

    const mailOptions = {
      from: '"ChitChat Test" <test@chitchat.local>',
      to: testEmail,
      subject: testSubject,
      html: testHtml
    };

    const info = await testTransporter.sendMail(mailOptions);

    APIResponse.send(res, APIResponse.success({
      message: 'Test email sent successfully',
      messageId: info.messageId,
      previewUrl: nodemailer.getTestMessageUrl(info),
      recipient: testEmail
    }));

  } catch (error) {
    console.error('Test email route error:', error);
    APIResponse.send(res, APIResponse.error('Failed to send test email', 500));
  }
});

module.exports = router;
