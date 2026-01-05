const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import shared modules
const { supabase, checkConnection } = require('../../shared/config/supabase');
const authMiddleware = require('../../shared/middleware/auth');

// Import service modules
const chatController = require('./src/controllers/chatController');
const chatRoutes = require('./src/routes/chat');
const socketHandler = require('./src/utils/socketHandler');

const app = express();
const server = createServer(app);
const PORT = process.env.CHAT_SERVICE_PORT || 3003;

// Socket.IO setup with optimized settings
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Performance optimizations
  pingTimeout: 60000,        // 60 seconds
  pingInterval: 25000,       // 25 seconds
  upgradeTimeout: 10000,     // 10 seconds
  maxHttpBufferSize: 1e6,    // 1MB
  connectTimeout: 20000,     // 20 seconds
  transports: ['websocket', 'polling']
});

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
  max: 500, // limit each IP to 500 requests per windowMs
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
    if (duration > 1000) {
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
    const connectedSockets = socketHandler.getConnectedSocketsCount();

    res.status(dbHealth.healthy ? 200 : 503).json({
      service: 'chat-service',
      status: dbHealth.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: dbHealth,
      sockets: {
        connected: connectedSockets,
        status: 'active'
      }
    });
  } catch (error) {
    res.status(503).json({
      service: 'chat-service',
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication middleware for HTTP routes
app.use('/api/chat', authMiddleware.verifyToken);

// API routes
app.use('/api/chat', chatRoutes);

// Socket.IO authentication and handling
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication token required'));
    }

    // Verify JWT token
    const jwtManager = require('../../shared/utils/jwt');
    const decoded = jwtManager.verifyAccessToken(token);

    // Check session in database
    const { data: session } = await supabase
      .from('sessions')
      .select('*, users(id, avatar_name, email)')
      .eq('session_token', decoded.sessionId)
      .eq('is_active', true)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!session) {
      return next(new Error('Invalid session'));
    }

    // Attach user to socket
    socket.user = session.users;
    socket.sessionId = decoded.sessionId;

    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication failed'));
  }
});

// Initialize socket handler
socketHandler.initialize(io);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    service: 'chat-service',
    path: req.originalUrl
  });
});

// Error handling
app.use((error, req, res, next) => {
  console.error('Chat Service Error:', error);
  res.status(error.status || 500).json({
    error: error.message || 'Internal server error',
    service: 'chat-service',
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down chat service gracefully');
  io.close(() => {
    console.log('Socket.IO server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down chat service gracefully');
  io.close(() => {
    console.log('Socket.IO server closed');
    process.exit(0);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Chat Service running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔌 Socket.IO enabled`);
});
