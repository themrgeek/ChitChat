const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import shared modules
const { supabase, checkConnection } = require('../../shared/config/supabase');
const authMiddleware = require('../../shared/middleware/auth');

// Import service modules
const profileController = require('./src/controllers/profileController');
const profileRoutes = require('./src/routes/profile');

const app = express();
const PORT = process.env.PROFILE_SERVICE_PORT || 3002;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Compression
app.use(compression({
  level: 6,
  threshold: 1024
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // limit each IP to 200 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  }
});

app.use(limiter);

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 500) {
      console.log(`🐌 SLOW: ${req.method} ${req.originalUrl} - ${duration}ms`);
    } else if (req.originalUrl.includes('/api/')) {
      console.log(`⚡ ${req.method} ${req.originalUrl} - ${duration}ms`);
    }
  });
  next();
});

// Health check
app.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkConnection();
    res.status(dbHealth.healthy ? 200 : 503).json({
      service: 'profile-service',
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth
    });
  } catch (error) {
    res.status(503).json({
      service: 'profile-service',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// All routes require authentication
app.use(authMiddleware.verifyToken);

// API routes
app.use('/api/profile', profileRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    service: 'profile-service',
    path: req.originalUrl
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Profile Service Error:', error);
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    service: 'profile-service',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down profile service gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down profile service gracefully');
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Profile Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
});
