const nodemailer = require("nodemailer");

class EmailService {
  constructor() {
    this.transporter = null;
    this.isTestAccount = false;
    this.setupTransporter();
  }

  async setupTransporter() {
    console.log("📧 Initializing email service...");

    // If no email config provided, use Ethereal test account
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.log(
        "📧 No email configuration found, using Ethereal test service..."
      );
      await this.setupEtherealTransporter();
      return;
    }

    // Try configured email service
    try {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      // Verify configuration
      await this.transporter.verify();
      console.log("✅ Email transporter configured successfully");
    } catch (error) {
      console.log(
        "❌ Configured email service failed, falling back to Ethereal..."
      );
      await this.setupEtherealTransporter();
    }
  }

  async setupEtherealTransporter() {
    try {
      console.log("📧 Creating Ethereal test account...");
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

      this.isTestAccount = true;

      console.log("📧 Ethereal test email configured:");
      console.log("   👤 User:", testAccount.user);
      console.log("   🔑 Pass:", testAccount.pass);
      console.log("   🌐 Web: https://ethereal.email");
    } catch (error) {
      console.log("❌ Ethereal failed, using console-only mode...");
      this.transporter = null;
    }
  }

  async sendOTPEmail(email, otp, avatarName, tempPassword) {
    // If no transporter, use console fallback
    if (!this.transporter) {
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
            '"ChitChat Security" <security@chitchat.com>',
        to: email,
        subject: "🔒 Your ChitChat Secure OTP",
        html: emailContent,
        text: this.createTextVersion(otp, avatarName, tempPassword),
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log("✅ Email sent successfully!");

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
      console.error("❌ Email sending failed:", error.message);
      // Fallback to console
      return this.sendConsoleFallback(email, otp, avatarName, tempPassword);
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
CHITCHAT SECURITY SYSTEM
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
}

module.exports = new EmailService();
