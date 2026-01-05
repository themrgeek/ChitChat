const jwt = require('jsonwebtoken');
const crypto = require('crypto');

class JWTManager {
  constructor() {
    this.secret = process.env.JWT_SECRET;
    if (!this.secret) {
      throw new Error('JWT_SECRET environment variable is required');
    }
  }

  // Generate access token
  generateAccessToken(userId, sessionId) {
    return jwt.sign(
      {
        userId,
        sessionId,
        type: 'access',
        iat: Math.floor(Date.now() / 1000)
      },
      this.secret,
      { expiresIn: '15m' } // Short-lived access token
    );
  }

  // Generate refresh token
  generateRefreshToken(userId, sessionId) {
    return jwt.sign(
      {
        userId,
        sessionId,
        type: 'refresh',
        iat: Math.floor(Date.now() / 1000)
      },
      this.secret,
      { expiresIn: '7d' } // Longer-lived refresh token
    );
  }

  // Generate session ID
  generateSessionId() {
    return crypto.randomUUID();
  }

  // Verify token
  verifyToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  // Verify access token
  verifyAccessToken(token) {
    const decoded = this.verifyToken(token);
    if (decoded.type !== 'access') {
      throw new Error('Invalid token type');
    }
    return decoded;
  }

  // Verify refresh token
  verifyRefreshToken(token) {
    const decoded = this.verifyToken(token);
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid token type');
    }
    return decoded;
  }

  // Extract token from Authorization header
  extractTokenFromHeader(authHeader) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }
    return authHeader.substring(7);
  }

  // Generate token pair
  generateTokenPair(userId) {
    const sessionId = this.generateSessionId();
    const accessToken = this.generateAccessToken(userId, sessionId);
    const refreshToken = this.generateRefreshToken(userId, sessionId);

    return {
      accessToken,
      refreshToken,
      sessionId
    };
  }

  // Refresh access token using refresh token
  refreshAccessToken(refreshToken) {
    try {
      const decoded = this.verifyRefreshToken(refreshToken);
      return this.generateAccessToken(decoded.userId, decoded.sessionId);
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
}

module.exports = new JWTManager();
