const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.isTestAccount = false;
    this.setupTransporter();
  }

  async setupTransporter() {
    try {
      console.log('📧 Setting up email transporter...');

      // Use Ethereal for testing/development
      const user = process.env.ETHEREAL_USER;
      const pass = process.env.ETHEREAL_PASS;

      if (!user || !pass) {
        console.warn('⚠️ Ethereal credentials not found, emails will be logged to console');
        this.transporter = null;
        return;
      }

      this.transporter = nodemailer.createTransporter({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: user,
          pass: pass
        },
        // Optimized settings
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 30000,
        disableFileAccess: true,
        disableUrlAccess: true
      });

      // Quick verification
      await Promise.race([
        this.transporter.verify(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Verification timeout')), 5000)
        )
      ]);

      this.isTestAccount = true;
      console.log('✅ Email transporter ready');

    } catch (error) {
      console.error('❌ Email transporter setup failed:', error.message);
      this.transporter = null;
    }
  }

  async sendOTPEmail(email, otp, avatarName, tempPassword) {
    if (!this.transporter) {
      return this.sendConsoleFallback(email, otp, avatarName, tempPassword);
    }

    const emailContent = this.createOTPEmailTemplate(otp, avatarName, tempPassword);

    try {
      const mailOptions = {
        from: '"ChitChat Security" <noreply@ethereal.email>',
        to: email,
        subject: '🔒 Your ChitChat Secure OTP',
        html: emailContent,
        text: this.createOTPTextVersion(otp, avatarName, tempPassword)
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`✅ OTP email sent to ${email}`);

      if (this.isTestAccount) {
        console.log(`📧 Preview: ${nodemailer.getTestMessageUrl(info)}`);
      }

      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error(`❌ OTP email failed for ${email}:`, error.message);
      return this.sendConsoleFallback(email, otp, avatarName, tempPassword);
    }
  }

  async sendCredentialsEmail(email, avatarName, tempPassword, etherealPassword) {
    if (!this.transporter) {
      return this.sendCredentialsConsoleFallback(email, avatarName, tempPassword, etherealPassword);
    }

    const emailContent = this.createCredentialsEmailTemplate(email, avatarName, tempPassword, etherealPassword);

    try {
      const mailOptions = {
        from: '"ChitChat Security" <noreply@ethereal.email>',
        to: email,
        subject: '🔐 Your ChitChat Identity Created',
        html: emailContent,
        text: this.createCredentialsTextVersion(email, avatarName, tempPassword, etherealPassword)
      };

      const info = await this.transporter.sendMail(mailOptions);

      console.log(`✅ Credentials email sent to ${email}`);

      if (this.isTestAccount) {
        console.log(`📧 Preview: ${nodemailer.getTestMessageUrl(info)}`);
      }

      return { success: true, messageId: info.messageId };

    } catch (error) {
      console.error(`❌ Credentials email failed for ${email}:`, error.message);
      return this.sendCredentialsConsoleFallback(email, avatarName, tempPassword, etherealPassword);
    }
  }

  sendConsoleFallback(email, otp, avatarName, tempPassword) {
    console.log('\n📧 ===== SECURE OTP EMAIL (CONSOLE) =====');
    console.log(`To: ${email}`);
    console.log(`OTP: ${otp}`);
    console.log(`Avatar: ${avatarName}`);
    console.log(`Password: ${tempPassword}`);
    console.log('Expires: 5 minutes');
    console.log('=========================================\n');

    return { success: true, fallback: true };
  }

  sendCredentialsConsoleFallback(email, avatarName, tempPassword, etherealPassword) {
    console.log('\n📧 ===== CREDENTIALS EMAIL (CONSOLE) =====');
    console.log(`To: ${email}`);
    console.log(`Avatar: ${avatarName}`);
    console.log(`Password: ${tempPassword}`);
    if (etherealPassword) {
      console.log(`Mailbox: ${email}`);
      console.log(`Mailbox Password: ${etherealPassword}`);
    }
    console.log('========================================\n');

    return { success: true, fallback: true };
  }

  createOTPEmailTemplate(otp, avatarName, tempPassword) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: monospace; background: #0d0d0d; color: #00ff00; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; border: 2px solid #00ff00; padding: 30px; background: #001100; }
        .otp-code { font-size: 32px; font-weight: bold; color: #00ffff; text-align: center; margin: 20px 0; }
        .warning { color: #ff4444; background: #330000; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔒 ChitChat Security</h1>
        <div class="warning">⚠️ Keep this secure - do not share!</div>
        <p>Your One-Time Password:</p>
        <div class="otp-code">${otp}</div>
        <p>Avatar: ${avatarName}</p>
        <p>Password: ${tempPassword}</p>
        <p>Expires in 5 minutes</p>
    </div>
</body>
</html>`;
  }

  createCredentialsEmailTemplate(email, avatarName, tempPassword, etherealPassword) {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        body { font-family: monospace; background: #0d0d0d; color: #00ff00; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; border: 2px solid #00ff00; padding: 30px; background: #001100; }
        .warning { color: #ff4444; background: #330000; padding: 10px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔐 ChitChat Identity Created</h1>
        <div class="warning">⚠️ Keep these credentials secure!</div>
        <p><strong>Avatar:</strong> ${avatarName}</p>
        <p><strong>Password:</strong> ${tempPassword}</p>
        ${etherealPassword ? `<p><strong>Mailbox:</strong> ${email}</p><p><strong>Mailbox Password:</strong> ${etherealPassword}</p>` : ''}
        <p>Use these to login to ChitChat</p>
    </div>
</body>
</html>`;
  }

  createOTPTextVersion(otp, avatarName, tempPassword) {
    return `ChitChat OTP: ${otp}\nAvatar: ${avatarName}\nPassword: ${tempPassword}\nExpires: 5 minutes`;
  }

  createCredentialsTextVersion(email, avatarName, tempPassword, etherealPassword) {
    return `ChitChat Credentials:\nAvatar: ${avatarName}\nPassword: ${tempPassword}${etherealPassword ? `\nMailbox: ${email}\nMailbox Password: ${etherealPassword}` : ''}`;
  }
}

module.exports = new EmailService();
