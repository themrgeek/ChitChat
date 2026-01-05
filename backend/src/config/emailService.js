const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
    this.isTestAccount = false;
    this.setupOptimizedTransporter();
  }

  async setupOptimizedTransporter() {
    console.log("📧 Initializing optimized email service...");

    // Use SMTP for production, fallback to console logging if no SMTP configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      await this.setupSMTPTransporter();
    } else {
      console.log("⚠️  No SMTP configuration found - emails will be logged to console only");
      this.transporter = null;
    }
  }

  async setupSMTPTransporter() {
    try {
      console.log("📧 Setting up SMTP transporter...");

      // Create SMTP transporter
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        // Performance and security optimizations
        connectionTimeout: 30000,
        greetingTimeout: 10000,
        socketTimeout: 60000,
        // Security settings
        tls: {
          ciphers: 'HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA',
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        },
        // Connection pooling
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 10
      });

      // Test connection
      try {
        console.log("🔍 Testing SMTP connection...");
        await Promise.race([
          this.transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('SMTP connection timeout')), 20000)
          )
        ]);
        this.isTestAccount = false;

        console.log("✅ SMTP transporter ready:");
        console.log("   📧 Host:", process.env.SMTP_HOST);
        console.log("   🔒 Secure:", process.env.SMTP_SECURE === 'true');
        console.log("   👤 User:", process.env.SMTP_USER);
        console.log("   📬 From:", process.env.EMAIL_FROM || process.env.SMTP_USER);

      } catch (verifyError) {
        console.error("❌ SMTP transporter verification failed:", verifyError.message);
        console.log("📧 Continuing anyway - emails may still work...");
        this.isTestAccount = false;
      }

    } catch (error) {
      console.error("❌ SMTP setup failed:", error);
      console.error("📧 Email service will not be available until SMTP configuration is fixed");
      this.transporter = null;
    }
  }




  async sendOTPEmail(email, otp, avatarName, tempPassword) {
    // If no transporter, use console fallback immediately
    if (!this.transporter) {
      console.log("⚠️ No email transporter available, using console fallback");
      return this.sendConsoleFallback(email, otp, avatarName, tempPassword);
    }

    const emailContent = this.createEmailTemplate(
      otp,
      avatarName,
      tempPassword
    );

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM ||
          `"ChitChat Security" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "🔒 Your ChitChat Secure OTP",
        html: emailContent,
        text: this.createTextVersion(otp, avatarName, tempPassword),
      };

      // Send email with timeout protection
      const info = await this.transporter.sendMail(mailOptions);

      console.log("✅ OTP Email sent successfully to:", email);
      console.log("📧 Message ID:", info.messageId);
      console.log("📧 Response:", info.response);
      console.log("📧 Sent via:", process.env.SMTP_HOST);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: null, // No preview URL for production SMTP
      };
    } catch (error) {
      console.error("❌ OTP Email sending failed:", error.message);
      console.error("❌ Error code:", error.code);
      console.error("❌ Error command:", error.command);
      console.error("❌ Full error:", error);

      // Check for common SMTP errors
      if (error.code === 'ECONNREFUSED') {
        console.error("❌ SMTP connection refused - check network/firewall");
      } else if (error.code === 'ETIMEDOUT') {
        console.error("❌ SMTP connection timeout - check network");
      } else if (error.code === 'EAUTH') {
        console.error("❌ SMTP authentication failed - check credentials");
      }

      // Always fallback to console for OTP (critical functionality)
      console.log("📧 Falling back to console logging for OTP delivery");
      console.log("🔍 Check Railway logs for detailed error information");
      return this.sendConsoleFallback(email, otp, avatarName, tempPassword);
    }
  }

  async sendCredentialsEmail(
    email,
    avatarName,
    tempPassword,
    etherealPassword = null
  ) {
    // If no transporter, use console fallback
    if (!this.transporter) {
      return this.sendCredentialsConsoleFallback(
        email,
        avatarName,
        tempPassword
      );
    }

    const emailContent = this.createCredentialsEmailTemplate(
      email,
      avatarName,
      tempPassword,
      etherealPassword
    );

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM ||
          `"ChitChat Security" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "🔐 Your ChitChat Secure Identity Created",
        html: emailContent,
        text: this.createCredentialsTextVersion(
          email,
          avatarName,
          tempPassword,
          null // Remove ethereal password reference
        ),
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log("✅ Credentials email sent successfully!");
      console.log("📧 Message ID:", info.messageId);
      console.log("📧 Sent via:", process.env.SMTP_HOST);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: this.isTestAccount
          ? nodemailer.getTestMessageUrl(info)
          : null,
      };
    } catch (error) {
      console.error("❌ Credentials email sending failed:", error.message);
      // Fallback to console
      return this.sendCredentialsConsoleFallback(
        email,
        avatarName,
        tempPassword,
        etherealPassword
      );
    }
  }

  async sendLoginOTPEmail(email, otp, avatarName) {
    // If no transporter, use console fallback
    if (!this.transporter) {
      return this.sendLoginOTPConsoleFallback(email, otp, avatarName);
    }

    const emailContent = this.createLoginOTPEmailTemplate(otp, avatarName);

    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM ||
          `"ChitChat Security" <${process.env.SMTP_USER}>`,
        to: email,
        subject: "🔒 ChitChat Login Verification",
        html: emailContent,
        text: this.createLoginOTPTextVersion(otp, avatarName),
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log("✅ Login OTP email sent successfully!");
      console.log("📧 Message ID:", info.messageId);
      console.log("📧 Sent via:", process.env.SMTP_HOST);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: this.isTestAccount
          ? nodemailer.getTestMessageUrl(info)
          : null,
      };
    } catch (error) {
      console.error("❌ Login OTP email sending failed:", error.message);
      // Fallback to console
      return this.sendLoginOTPConsoleFallback(email, otp, avatarName);
    }
  }

  sendConsoleFallback(email, otp, avatarName, tempPassword) {
    console.log("\n📧 ===== SECURE OTP EMAIL (CONSOLE FALLBACK) =====");
    console.log(`📧 To: ${email}`);
    console.log(`🔐 OTP Code: ${otp}`);
    console.log(`👤 Avatar Name: ${avatarName}`);
    console.log(`🔑 Temporary Password: ${tempPassword}`);
    console.log("⏰ Expires: 5 minutes");
    console.log("📧 ==============================================\n");

    return {
      success: true,
      fallback: true,
      message: "OTP displayed in console (email service unavailable)",
    };
  }

  createEmailTemplate(otp, avatarName, tempPassword) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { 
            font-family: 'Courier New', monospace; 
            background: #0d0d0d; 
            color: #00ff00; 
            margin: 0; 
            padding: 20px; 
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            border: 2px solid #00ff00; 
            border-radius: 10px; 
            padding: 30px; 
            background: #001100;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        }
        .header { 
            text-align: center; 
            border-bottom: 1px solid #00ff00; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .otp-box { 
            background: #002200; 
            padding: 20px; 
            border: 1px solid #00ffff; 
            border-radius: 5px; 
            text-align: center; 
            margin: 20px 0; 
        }
        .otp-code { 
            font-size: 32px; 
            font-weight: bold; 
            letter-spacing: 5px; 
            color: #00ffff; 
            margin: 10px 0; 
        }
        .credentials { 
            background: #002200; 
            padding: 15px; 
            border: 1px solid #00ff00; 
            border-radius: 5px; 
            margin: 15px 0; 
        }
        .footer { 
            text-align: center; 
            margin-top: 30px; 
            padding-top: 20px; 
            border-top: 1px solid #00ff00; 
            font-size: 12px; 
            color: #888; 
        }
        .warning { 
            color: #ff4444; 
            background: #330000; 
            padding: 10px; 
            border-radius: 3px; 
            margin: 10px 0; 
        }
        .preview-notice {
            background: #003300;
            padding: 10px;
            border: 1px solid #00ff00;
            border-radius: 3px;
            margin: 10px 0;
            font-size: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #00ff00; text-shadow: 0 0 10px #00ff00;">🔒 ChitChat Security System</h1>
            <p>Secure P2P Encrypted Messaging</p>
        </div>

        <div class="warning">
            ⚠️ SECURITY NOTICE: This OTP is for your eyes only. Do not share with anyone.
        </div>

        <div class="otp-box">
            <h3>Your One-Time Password</h3>
            <div class="otp-code">${otp}</div>
            <p><strong>Expires in: 5 minutes</strong></p>
        </div>

        <div class="credentials">
            <h3>🕵️ Your Secure Identity</h3>
            <p><strong>Avatar Name:</strong> ${avatarName}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p><em>Keep these credentials secure. They are your access key.</em></p>
        </div>

        <div class="footer">
            <p>This is an automated message from ChitChat Secure Messaging System.</p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>🔐 End-to-End Encrypted • 🚀 P2P Communication • 💾 Local Storage</p>
        </div>
    </div>
</body>
</html>
        `;
  }

  createTextVersion(otp, avatarName, tempPassword) {
    return `
ChitChat SECURITY SYSTEM
========================

Your One-Time Password: ${otp}
Expires in: 5 minutes

Your Secure Identity:
- Avatar Name: ${avatarName}
- Temporary Password: ${tempPassword}

SECURITY NOTICE: This OTP is for your eyes only. Do not share with anyone.

This is an automated message from ChitChat Secure Messaging System.
If you didn't request this, please ignore this email.
        `;
  }

  // Console fallbacks
  sendCredentialsConsoleFallback(
    email,
    avatarName,
    tempPassword,
    mailboxPassword = null
  ) {
    console.log("\n📧 ===== SECURE CREDENTIALS EMAIL (CONSOLE FALLBACK) =====");
    console.log(`📧 To: ${email}`);
    console.log(`👤 Avatar Name: ${avatarName}`);
    console.log(`🔑 Temporary Password: ${tempPassword}`);
    if (mailboxPassword) {
      console.log(`🔐 Mailbox Password: ${mailboxPassword}`);
      console.log("📧 Check your email for login credentials");
    }
    console.log("⏰ Keep these credentials secure!");
    console.log("📧 =================================================\n");

    return {
      success: true,
      fallback: true,
      message: "Credentials displayed in console (email service unavailable)",
    };
  }

  sendLoginOTPConsoleFallback(email, otp, avatarName) {
    console.log("\n📧 ===== LOGIN OTP EMAIL (CONSOLE FALLBACK) =====");
    console.log(`📧 To: ${email}`);
    console.log(`👤 Avatar: ${avatarName}`);
    console.log(`🔐 Login OTP Code: ${otp}`);
    console.log("⏰ Expires: 5 minutes");
    console.log("📧 ==============================================\n");

    return {
      success: true,
      fallback: true,
      message: "Login OTP displayed in console (email service unavailable)",
    };
  }

  // Email templates
  createCredentialsEmailTemplate(
    email,
    avatarName,
    tempPassword,
    mailboxPassword = null
  ) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: #0d0d0d;
            color: #00ff00;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 30px;
            background: #001100;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        }
        .header {
            text-align: center;
            border-bottom: 1px solid #00ff00;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .credentials {
            background: #002200;
            padding: 20px;
            border: 1px solid #00ff00;
            border-radius: 5px;
            margin: 20px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #00ff00;
            font-size: 12px;
            color: #888;
        }
        .warning {
            color: #ff4444;
            background: #330000;
            padding: 10px;
            border-radius: 3px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #00ff00; text-shadow: 0 0 10px #00ff00;">🔐 ChitChat Identity Created</h1>
            <p>Secure P2P Encrypted Messaging</p>
        </div>

        <div class="warning">
            ⚠️ SECURITY NOTICE: Keep these credentials secure. They are your access key.
        </div>

        <div class="credentials">
            <h3>🕵️ Your Secure Identity</h3>
            <p><strong>Avatar Name:</strong> ${avatarName}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
            <p><em>Use these credentials to login to ChitChat.</em></p>
        </div>

        ${
          mailboxPassword
            ? `
        <div class="credentials">
            <h3>📧 Your Secure Mailbox</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> ${mailboxPassword}</p>
            <p><em>Check your email inbox for your login credentials</em></p>
        </div>
        `
            : ""
        }

        <div class="footer">
            <p>This is an automated message from ChitChat Secure Messaging System.</p>
            <p>🔐 End-to-End Encrypted • 🚀 P2P Communication • 💾 Local Storage</p>
        </div>
    </div>
</body>
</html>
        `;
  }

  createLoginOTPEmailTemplate(otp, avatarName) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body {
            font-family: 'Courier New', monospace;
            background: #0d0d0d;
            color: #00ff00;
            margin: 0;
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            border: 2px solid #00ff00;
            border-radius: 10px;
            padding: 30px;
            background: #001100;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
        }
        .header {
            text-align: center;
            border-bottom: 1px solid #00ff00;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .otp-box {
            background: #002200;
            padding: 20px;
            border: 1px solid #00ffff;
            border-radius: 5px;
            text-align: center;
            margin: 20px 0;
        }
        .otp-code {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 5px;
            color: #00ffff;
            margin: 10px 0;
        }
        .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #00ff00;
            font-size: 12px;
            color: #888;
        }
        .warning {
            color: #ff4444;
            background: #330000;
            padding: 10px;
            border-radius: 3px;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="color: #00ff00; text-shadow: 0 0 10px #00ff00;">🔒 ChitChat Login Verification</h1>
            <p>Avatar: ${avatarName}</p>
        </div>

        <div class="warning">
            ⚠️ SECURITY NOTICE: This OTP is for your eyes only. Do not share with anyone.
        </div>

        <div class="otp-box">
            <h3>Your Login Verification Code</h3>
            <div class="otp-code">${otp}</div>
            <p><strong>Expires in: 5 minutes</strong></p>
        </div>

        <div class="footer">
            <p>This is an automated message from ChitChat Secure Messaging System.</p>
            <p>If you didn't request this login, please ignore this email.</p>
            <p>🔐 End-to-End Encrypted • 🚀 P2P Communication • 💾 Local Storage</p>
        </div>
    </div>
</body>
</html>
        `;
  }

  createCredentialsTextVersion(
    email,
    avatarName,
    tempPassword,
    mailboxPassword = null
  ) {
    return `
ChitChat IDENTITY CREATED
=========================

Your Secure Identity:
- Avatar Name: ${avatarName}
- Temporary Password: ${tempPassword}

${
  mailboxPassword
    ? `
Your Secure Mailbox:
- Email: ${email}
- Password: ${mailboxPassword}
- Check your email inbox for login credentials
`
    : ""
}

SECURITY NOTICE: Keep these credentials secure. They are your access key.

This is an automated message from ChitChat Secure Messaging System.
        `;
  }

  createLoginOTPTextVersion(otp, avatarName) {
    return `
ChitChat LOGIN VERIFICATION
===========================

Avatar: ${avatarName}
Your Login OTP: ${otp}
Expires in: 5 minutes

SECURITY NOTICE: This OTP is for your eyes only. Do not share with anyone.

This is an automated message from ChitChat Secure Messaging System.
If you didn't request this login, please ignore this email.
        `;
  }

  // Health check method for debugging email service
  async healthCheck() {
    try {
      const health = {
        transporterReady: !!this.transporter,
        isTestAccount: this.isTestAccount,
        cachedAccount: !!this.cachedEtherealAccount,
        timestamp: new Date().toISOString()
      };

      if (this.transporter) {
        try {
          await Promise.race([
            this.transporter.verify(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Health check timeout')), 5000)
            )
          ]);
          health.transporterVerified = true;
          health.status = 'healthy';
        } catch (verifyError) {
          health.transporterVerified = false;
          health.verificationError = verifyError.message;
          health.status = 'degraded';
        }
      } else {
        health.status = 'unhealthy';
      }

      return health;
    } catch (error) {
      return {
        status: 'error',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = new EmailService();
