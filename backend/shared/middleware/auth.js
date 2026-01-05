const jwtUtils = require('../utils/jwt');
const { supabaseAdmin } = require('../../config/supabase');
const { APIResponse, ServiceResult } = require('../utils/response');
const { sessionCache } = require('../utils/cache');

/**
 * Authentication middleware for JWT session validation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function authenticateSession(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      return APIResponse.send(res, APIResponse.authError('No authentication token provided'));
    }

    // Verify JWT token
    const decoded = jwtUtils.verifyToken(token, 'session');
    if (!decoded || !decoded.userId) {
      return APIResponse.send(res, APIResponse.authError('Invalid authentication token'));
    }

    // Check session in cache first
    let sessionData = sessionCache.get(`session:${token}`);

    if (!sessionData) {
      // Fetch from database
      const { data: session, error } = await supabaseAdmin
        .from('sessions')
        .select(`
          *,
          users:user_id (
            id,
            email,
            avatar_name,
            email_verified,
            is_active,
            created_at,
            last_login
          )
        `)
        .eq('session_token', token)
        .eq('expires_at', 'gt', new Date().toISOString())
        .single();

      if (error || !session) {
        return APIResponse.send(res, APIResponse.authError('Session not found or expired'));
      }

      if (!session.users?.is_active) {
        return APIResponse.send(res, APIResponse.forbidden('Account is deactivated'));
      }

      sessionData = session;
      // Cache session for 15 minutes
      sessionCache.set(`session:${token}`, sessionData, 900000);
    }

    // Attach user and session to request
    req.user = sessionData.users;
    req.session = {
      id: sessionData.id,
      token: sessionData.session_token,
      expiresAt: sessionData.expires_at,
      deviceInfo: sessionData.device_info,
      ipAddress: sessionData.ip_address
    };

    next();
  } catch (error) {
    console.error('Authentication middleware error:', error);
    return APIResponse.send(res, APIResponse.authError('Authentication failed'));
  }
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = jwtUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      req.user = null;
      req.session = null;
      return next();
    }

    // Try to authenticate, but don't fail if invalid
    try {
      const decoded = jwtUtils.verifyToken(token, 'session');

      if (decoded && decoded.userId) {
        let sessionData = sessionCache.get(`session:${token}`);

        if (!sessionData) {
          const { data: session, error } = await supabaseAdmin
            .from('sessions')
            .select(`
              *,
              users:user_id (
                id,
                email,
                avatar_name,
                email_verified,
                is_active,
                created_at,
                last_login
              )
            `)
            .eq('session_token', token)
            .eq('expires_at', 'gt', new Date().toISOString())
            .single();

          if (!error && session) {
            sessionData = session;
            sessionCache.set(`session:${token}`, sessionData, 900000);
          }
        }

        if (sessionData) {
          req.user = sessionData.users;
          req.session = {
            id: sessionData.id,
            token: sessionData.session_token,
            expiresAt: sessionData.expires_at,
            deviceInfo: sessionData.device_info,
            ipAddress: sessionData.ip_address
          };
        }
      }
    } catch (authError) {
      // Ignore auth errors for optional auth
      console.log('Optional auth failed, continuing without authentication');
    }

    next();
  } catch (error) {
    console.error('Optional authentication error:', error);
    next();
  }
}

/**
 * Role-based authorization middleware
 * @param {string[]} allowedRoles - Array of allowed roles
 * @returns {Function} Middleware function
 */
function requireRole(allowedRoles) {
  return async (req, res, next) => {
    if (!req.user) {
      return APIResponse.send(res, APIResponse.authError('Authentication required'));
    }

    // Check user role (implement based on your role system)
    const userRole = req.user.role || 'user';

    if (!allowedRoles.includes(userRole)) {
      return APIResponse.send(res, APIResponse.forbidden('Insufficient permissions'));
    }

    next();
  };
}

/**
 * Rate limiting middleware for authentication endpoints
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
function rateLimitAuth(req, res, next) {
  const clientIP = req.ip || req.connection.remoteAddress;
  const endpoint = req.path;
  const key = `ratelimit:${clientIP}:${endpoint}`;

  // Simple in-memory rate limiting (for production, use Redis)
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = endpoint.includes('/otp') ? 5 : 10; // Stricter for OTP

  if (!global.rateLimitStore) {
    global.rateLimitStore = new Map();
  }

  const clientData = global.rateLimitStore.get(key) || { count: 0, resetTime: now + windowMs };

  if (now > clientData.resetTime) {
    clientData.count = 0;
    clientData.resetTime = now + windowMs;
  }

  clientData.count++;

  if (clientData.count > maxRequests) {
    const resetIn = Math.ceil((clientData.resetTime - now) / 1000);
    global.rateLimitStore.set(key, clientData);

    return APIResponse.send(res, APIResponse.error(
      `Too many requests. Try again in ${resetIn} seconds.`,
      429,
      {
        type: 'rate_limit_exceeded',
        retryAfter: resetIn
      }
    ));
  }

  global.rateLimitStore.set(key, clientData);

  // Add rate limit headers
  res.set({
    'X-RateLimit-Limit': maxRequests,
    'X-RateLimit-Remaining': Math.max(0, maxRequests - clientData.count),
    'X-RateLimit-Reset': new Date(clientData.resetTime).toISOString()
  });

  next();
}

/**
 * Session activity update middleware
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Next middleware function
 */
async function updateSessionActivity(req, res, next) {
  if (req.session && req.user) {
    try {
      // Update session last activity
      await supabaseAdmin
        .from('sessions')
        .update({ last_activity: new Date().toISOString() })
        .eq('id', req.session.id);

      // Update user profile last seen
      await supabaseAdmin
        .from('user_profiles')
        .update({
          last_seen: new Date().toISOString(),
          status: 'online',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', req.user.id);

      // Clear relevant caches
      sessionCache.delete(`session:${req.session.token}`);

    } catch (error) {
      console.error('Failed to update session activity:', error);
      // Don't fail the request for activity updates
    }
  }

  next();
}

module.exports = {
  authenticateSession,
  optionalAuth,
  requireRole,
  rateLimitAuth,
  updateSessionActivity
};
