const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
    this.isTestAccount = false;
    this.cachedEtherealAccount = null; // Cache for Ethereal account
    this.connectionPool = []; // Pool of transporter connections
    this.setupOptimizedTransporter();
  }

  async setupOptimizedTransporter() {
    console.log("📧 Initializing optimized email service...");

    // Always use optimized Ethereal for development/production
    await this.setupEtherealOptimizedTransporter();
  }

  async setupEtherealOptimizedTransporter() {
    try {
      console.log("📧 Setting up optimized Ethereal transporter with connection pooling...");

      // Get cached account credentials
      const user = await this.getEtherealUser();
      const pass = await this.getEtherealPass();

      // Create optimized transporter with connection pooling
      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        pool: true, // Enable connection pooling
        maxConnections: 2, // Reduced for Railway stability
        maxMessages: 50, // Messages per connection
        rateLimit: 5, // Conservative rate limiting
        auth: {
          user: user,
          pass: pass,
        },
        // Performance optimizations
        disableFileAccess: true,
        disableUrlAccess: true,
        // Add timeout to prevent hanging
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 15000,
      });

      // Test connection with timeout
      try {
        await Promise.race([
          this.transporter.verify(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 10000)
          )
        ]);
        this.isTestAccount = true;

        console.log("✅ Optimized Ethereal transporter ready:");
        console.log("   👤 User:", user);
        console.log("   🔑 Pass:", pass.substring(0, 8) + "...");
        console.log("   🌐 Web: https://ethereal.email");
        console.log("   ⚡ Connection pooling: Enabled");
        console.log("   📊 Max connections: 2");

      } catch (verifyError) {
        console.error("❌ Transporter verification failed:", verifyError.message);
        console.log("📧 Continuing without verification (may still work)...");
        this.isTestAccount = true; // Assume it works
      }
    }
  }

  async setupBasicEtherealFallback() {
    try {
      const testAccount = await nodemailer.createTestAccount();

      this.transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });

      this.cachedEtherealAccount = {
        user: testAccount.user,
        pass: testAccount.pass,
        email: testAccount.user,
      };

      this.isTestAccount = true;
      console.log("✅ Basic Ethereal fallback ready");
    } catch (error) {
      console.error("❌ Basic Ethereal fallback failed:", error);
      this.transporter = null;
    }
  }

  async getEtherealUser() {
    if (this.cachedEtherealAccount?.user) {
      return this.cachedEtherealAccount.user;
    }

    const testAccount = await nodemailer.createTestAccount();
    this.cachedEtherealAccount = {
      user: testAccount.user,
      pass: testAccount.pass,
      email: testAccount.user,
    };

    return this.cachedEtherealAccount.user;
  }

  async getEtherealPass() {
    if (this.cachedEtherealAccount?.pass) {
      return this.cachedEtherealAccount.pass;
    }

    const testAccount = await nodemailer.createTestAccount();
    this.cachedEtherealAccount = {
      user: testAccount.user,
      pass: testAccount.pass,
      email: testAccount.user,
    };

    return this.cachedEtherealAccount.pass;
  }

  async createEtherealAccount() {
    try {
      console.log("📧 Setting up Ethereal account for user...");

      // Since Ethereal reuses the same test account, we'll use the server's main account
      // but make emails identifiable by avatar name in the subject/content
      // This is acceptable for a demo system focused on untraceable messaging

      // Use cached account if available (major performance optimization)
      if (this.cachedEtherealAccount) {
        console.log("✅ Using cached Ethereal account");
        return this.cachedEtherealAccount;
      }

      // Create and cache the Ethereal account (only once per server startup)
      console.log("📧 Creating and caching Ethereal test account...");
      const testAccount = await nodemailer.createTestAccount();
      const userPart = testAccount.user.includes("@")
        ? testAccount.user.split("@")[0]
        : testAccount.user;

      this.cachedEtherealAccount = {
        user: userPart,
        pass: testAccount.pass,
        email: `${userPart}@ethereal.email`,
      };

      console.log("✅ Ethereal account cached for future use");
      return this.cachedEtherealAccount;
    } catch (error) {
      console.error("❌ Failed to setup Ethereal account:", error);
      throw new Error("Failed to setup Ethereal email account");
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
        from: this.isTestAccount
          ? '"ChitChat Security" <noreply@ethereal.email>'
          : process.env.EMAIL_FROM ||
            '"ChitChat Security" <security@chitchat-app.com>',
        to: email,
        subject: "🔒 Your ChitChat Secure OTP",
        html: emailContent,
        text: this.createTextVersion(otp, avatarName, tempPassword),
      };

      // Add timeout to prevent hanging
      const sendPromise = this.transporter.sendMail(mailOptions);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email send timeout')), 15000)
      );

      const info = await Promise.race([sendPromise, timeoutPromise]);

      console.log("✅ OTP Email sent successfully to:", email);

      if (this.isTestAccount) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log("📧 Email Preview URL:", previewUrl);
        console.log(
          "💡 Click the above URL to view the email in your browser!"
        );
      }

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: this.isTestAccount
          ? nodemailer.getTestMessageUrl(info)
          : null,
      };
    } catch (error) {
      console.error("❌ OTP Email sending failed:", error.message);

      // Always fallback to console for OTP (critical functionality)
      console.log("📧 Falling back to console logging for OTP delivery");
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
        from: this.isTestAccount
          ? '"ChitChat Security" <noreply@ethereal.email>'
          : process.env.EMAIL_FROM ||
            '"ChitChat Security" <security@chitchat-app.com>',
        to: email,
        subject: "🔐 Your ChitChat Secure Identity Created",
        html: emailContent,
        text: this.createCredentialsTextVersion(
          email,
          avatarName,
          tempPassword,
          etherealPassword
        ),
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log("✅ Credentials email sent successfully!");

      if (this.isTestAccount) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log("📧 Email Preview URL:", previewUrl);
        console.log(
          "💡 Click the above URL to view the email in your browser!"
        );
      }

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
        from: this.isTestAccount
          ? '"ChitChat Security" <noreply@ethereal.email>'
          : process.env.EMAIL_FROM ||
            '"ChitChat Security" <security@chitchat-app.com>',
        to: email,
        subject: "🔒 ChitChat Login Verification",
        html: emailContent,
        text: this.createLoginOTPTextVersion(otp, avatarName),
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log("✅ Login OTP email sent successfully!");

      if (this.isTestAccount) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        console.log("📧 Email Preview URL:", previewUrl);
        console.log(
          "💡 Click the above URL to view the email in your browser!"
        );
      }

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
        
        ${
          this.isTestAccount
            ? `
        <div class="preview-notice">
            🔍 <strong>TEST MODE</strong> - This is an Ethereal Email preview
        </div>
        `
            : ""
        }

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
    etherealPassword = null
  ) {
    console.log("\n📧 ===== SECURE CREDENTIALS EMAIL (CONSOLE FALLBACK) =====");
    console.log(`📧 To: ${email}`);
    console.log(`👤 Avatar Name: ${avatarName}`);
    console.log(`🔑 Temporary Password: ${tempPassword}`);
    if (etherealPassword) {
      console.log(`🔐 Ethereal Mailbox Password: ${etherealPassword}`);
      console.log("🌐 Login at: https://ethereal.email");
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
    etherealPassword = null
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
          etherealPassword
            ? `
        <div class="credentials">
            <h3>📧 Your Ethereal Mailbox</h3>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Password:</strong> ${etherealPassword}</p>
            <p><em>Use these to access your secure mailbox at <a href="https://ethereal.email" style="color: #00ff00;">ethereal.email</a></em></p>
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
    etherealPassword = null
  ) {
    return `
ChitChat IDENTITY CREATED
=========================

Your Secure Identity:
- Avatar Name: ${avatarName}
- Temporary Password: ${tempPassword}

${
  etherealPassword
    ? `
Your Ethereal Mailbox:
- Email: ${email}
- Password: ${etherealPassword}
- Access at: https://ethereal.email
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
}

module.exports = new EmailService();
