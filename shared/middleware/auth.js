const jwtManager = require('../utils/jwt');
const { supabase } = require('../config/supabase');

class AuthMiddleware {
  // Verify JWT token and attach user to request
  async verifyToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = jwtManager.extractTokenFromHeader(authHeader);

      if (!token) {
        return res.status(401).json({
          error: 'Access token required',
          code: 'TOKEN_MISSING'
        });
      }

      // Verify JWT
      const decoded = jwtManager.verifyAccessToken(token);

      // Check if session exists in database
      const { data: session, error } = await supabase
        .from('sessions')
        .select(`
          id,
          user_id,
          expires_at,
          is_active,
          users (
            id,
            email,
            avatar_name,
            email_verified,
            is_active
          )
        `)
        .eq('session_token', token)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !session) {
        return res.status(401).json({
          error: 'Invalid or expired session',
          code: 'SESSION_INVALID'
        });
      }

      // Check if user is active
      if (!session.users.is_active) {
        return res.status(403).json({
          error: 'Account is deactivated',
          code: 'ACCOUNT_INACTIVE'
        });
      }

      // Attach user and session to request
      req.user = session.users;
      req.session = {
        id: session.id,
        token: token
      };

      next();
    } catch (error) {
      console.error('Auth middleware error:', error.message);
      return res.status(401).json({
        error: 'Authentication failed',
        code: 'AUTH_FAILED'
      });
    }
  }

  // Optional authentication (doesn't fail if no token)
  async optionalAuth(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      const token = jwtManager.extractTokenFromHeader(authHeader);

      if (!token) {
        req.user = null;
        req.session = null;
        return next();
      }

      // Same verification as verifyToken
      const decoded = jwtManager.verifyAccessToken(token);

      const { data: session, error } = await supabase
        .from('sessions')
        .select(`
          id,
          user_id,
          expires_at,
          is_active,
          users (
            id,
            email,
            avatar_name,
            email_verified,
            is_active
          )
        `)
        .eq('session_token', token)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (error || !session || !session.users.is_active) {
        req.user = null;
        req.session = null;
      } else {
        req.user = session.users;
        req.session = {
          id: session.id,
          token: token
        };
      }

      next();
    } catch (error) {
      req.user = null;
      req.session = null;
      next();
    }
  }

  // Verify user owns resource
  verifyOwnership(resourceUserId) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (req.user.id !== resourceUserId) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      next();
    };
  }

  // Check if user has specific permission
  checkPermission(permission) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // For now, basic permission check
      // Can be extended with role-based permissions later
      const userPermissions = ['read', 'write', 'admin'];

      if (!userPermissions.includes(permission)) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS'
        });
      }

      next();
    };
  }

  // Rate limiting for auth endpoints
  authRateLimit() {
    const authLimits = new Map();

    return (req, res, next) => {
      const key = req.ip;
      const now = Date.now();
      const windowMs = 15 * 60 * 1000; // 15 minutes
      const maxRequests = 5; // 5 auth attempts per 15 minutes

      if (!authLimits.has(key)) {
        authLimits.set(key, { count: 1, resetTime: now + windowMs });
      } else {
        const limit = authLimits.get(key);

        if (now > limit.resetTime) {
          limit.count = 1;
          limit.resetTime = now + windowMs;
        } else if (limit.count >= maxRequests) {
          return res.status(429).json({
            error: 'Too many authentication attempts',
            code: 'RATE_LIMIT_EXCEEDED',
            retryAfter: Math.ceil((limit.resetTime - now) / 1000)
          });
        } else {
          limit.count++;
        }
      }

      next();
    };
  }
}

module.exports = new AuthMiddleware();
