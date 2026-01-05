const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTUtils {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    if (!this.secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  /**
   * Generate a new JWT session token
   * @param {string} userId - User ID
   * @param {Object} payload - Additional payload data
   * @returns {string} JWT token
   */
  generateSessionToken(userId, payload = {}) {
    const sessionId = crypto.randomUUID();
    const tokenPayload = {
      userId,
      sessionId,
      type: 'session',
      ...payload
    };

    return jwt.sign(tokenPayload, this.secret, {
      expiresIn: '24h',
      issuer: 'chitchat-auth-service',
      audience: 'chitchat-users'
    });
  }

  /**
   * Generate a refresh token
   * @param {string} userId - User ID
   * @param {string} sessionId - Session ID
   * @returns {string} Refresh token
   */
  generateRefreshToken(userId, sessionId) {
    return jwt.sign({
      userId,
      sessionId,
      type: 'refresh'
    }, this.secret, {
      expiresIn: '30d',
      issuer: 'chitchat-auth-service',
      audience: 'chitchat-users'
    });
  }

  /**
   * Verify and decode a JWT token
   * @param {string} token - JWT token to verify
   * @param {string} expectedType - Expected token type (session, refresh)
   * @returns {Object} Decoded payload
   */
  verifyToken(token, expectedType = null) {
    try {
      const decoded = jwt.verify(token, this.secret, {
        issuer: 'chitchat-auth-service',
        audience: 'chitchat-users'
      });

      if (expectedType && decoded.type !== expectedType) {
        throw new Error(`Invalid token type. Expected ${expectedType}, got ${decoded.type}`);
      }

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token has expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw error;
      }
    }
  }

  /**
   * Extract token from Authorization header
   * @param {string} authHeader - Authorization header value
   * @returns {string} Token without Bearer prefix
   */
  extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  /**
   * Check if token is expired
   * @param {string} token - JWT token
   * @returns {boolean} True if expired
   */
  isTokenExpired(token) {
    try {
      this.verifyToken(token);
      return false;
    } catch (error) {
      return error.message === 'Token has expired';
    }
  }

  /**
   * Get token expiration time
   * @param {string} token - JWT token
   * @returns {Date} Expiration date
   */
  getTokenExpiration(token) {
    try {
      const decoded = jwt.decode(token);
      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token');
      }
      return new Date(decoded.exp * 1000);
    } catch (error) {
      throw new Error('Unable to decode token');
    }
  }
}

module.exports = new JWTUtils();
