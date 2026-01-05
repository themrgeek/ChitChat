// Email service wrapper for microservice architecture
const emailService = require('../../src/config/emailService');

class EmailServiceWrapper {
  /**
   * Send OTP email
   * @param {string} email - Recipient email
   * @param {string} otp - OTP code
   * @param {string} avatarName - User's avatar name
   * @param {string} tempPassword - Temporary password
   * @returns {Promise} Email send result
   */
  async sendOTPEmail(email, otp, avatarName, tempPassword) {
    return await emailService.sendOTPEmail(email, otp, avatarName, tempPassword);
  }

  /**
   * Send credentials email
   * @param {string} email - Recipient email
   * @param {string} avatarName - User's avatar name
   * @param {string} tempPassword - Temporary password
   * @param {string} etherealPassword - Ethereal mailbox password
   * @returns {Promise} Email send result
   */
  async sendCredentialsEmail(email, avatarName, tempPassword, etherealPassword) {
    return await emailService.sendCredentialsEmail(email, avatarName, tempPassword, etherealPassword);
  }

  /**
   * Send login OTP email
   * @param {string} email - Recipient email
   * @param {string} otp - OTP code
   * @param {string} avatarName - User's avatar name
   * @returns {Promise} Email send result
   */
  async sendLoginOTPEmail(email, otp, avatarName) {
    return await emailService.sendLoginOTPEmail(email, otp, avatarName);
  }

  /**
   * Health check for email service
   * @returns {Promise} Health status
   */
  async healthCheck() {
    return await emailService.healthCheck();
  }
}

module.exports = new EmailServiceWrapper();
