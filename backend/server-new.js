const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const compression = require('compression');
const cors = require('cors');
const helmet = require('helmet');
const { APIResponse } = require('./shared/utils/response');
const { updateSessionActivity } = require('./shared/middleware/auth');

// Import service routes
const authRoutes = require('./services/auth/authRoutes');
const profileRoutes = require('./services/profile/profileRoutes');
const chatRoutes = require('./services/chat/chatRoutes');
const emailRoutes = require('./services/email/emailRoutes');

// Import services for cleanup and health checks
const authService = require('./services/auth/authService');
const profileService = require('./services/profile/profileService');
const emailService = require('./services/email/emailService');

const app = express();
const server = http.createServer(app);

// Socket.IO setup for real-time features
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  httpCompression: true,
  perMessageDeflate: true
});

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Compression middleware
app.use(compression({
  level: 6,
  threshold: 1024,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${req.method} ${req.originalUrl} - ${req.ip}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    if (duration > 1000) {
      console.log(`🐌 SLOW: ${req.method} ${req.originalUrl} - ${duration}ms (${status})`);
    } else if (req.originalUrl.includes('/api/')) {
      console.log(`⚡ ${req.method} ${req.originalUrl} - ${duration}ms (${status})`);
    }
  });

  next();
});

// Session activity tracking
app.use('/api', updateSessionActivity);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      services: {}
    };

    // Check database connectivity
    try {
      const { supabaseAdmin } = require('./config/supabase');
      const { data, error } = await supabaseAdmin.from('users').select('count').limit(1);
      health.services.database = error ? 'unhealthy' : 'healthy';
    } catch (dbError) {
      health.services.database = 'unhealthy';
      console.error('Database health check failed:', dbError);
    }

    // Check email service
    try {
      const emailHealth = await emailService.healthCheck();
      health.services.email = emailHealth.status;
    } catch (emailError) {
      health.services.email = 'unhealthy';
      console.error('Email health check failed:', emailError);
    }

    const overallStatus = Object.values(health.services).every(s => s === 'healthy')
      ? 'healthy'
      : 'degraded';

    health.status = overallStatus;

    APIResponse.send(res, APIResponse.success(health));

  } catch (error) {
    console.error('Health check error:', error);
    APIResponse.send(res, APIResponse.error('Health check failed', 500));
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/email', emailRoutes);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  APIResponse.send(res, APIResponse.notFound('API endpoint'));
});

// Static file serving for frontend (if deploying together)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static('../frontend'));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
  });
}

// Socket.IO connection handling
const connectedUsers = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  socket.on('authenticate', async (data) => {
    try {
      const { token } = data;

      if (!token) {
        socket.emit('auth_error', { message: 'No token provided' });
        return;
      }

      // Validate session
      const result = await authService.validateSession(token);

      if (!result.success) {
        socket.emit('auth_error', { message: 'Invalid session' });
        socket.disconnect();
        return;
      }

      const user = result.data.session.users;
      socket.userId = user.id;
      socket.avatarName = user.avatar_name;

      // Track connected user
      connectedUsers.set(user.id, {
        socketId: socket.id,
        avatarName: user.avatar_name,
        connectedAt: new Date()
      });

      socket.emit('authenticated', {
        user: {
          id: user.id,
          avatarName: user.avatar_name,
          email: user.email
        }
      });

      console.log(`✅ User authenticated: ${user.avatar_name} (${socket.id})`);

      // Broadcast user online status
      socket.broadcast.emit('user_online', {
        userId: user.id,
        avatarName: user.avatar_name,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Socket authentication error:', error);
      socket.emit('auth_error', { message: 'Authentication failed' });
      socket.disconnect();
    }
  });

  socket.on('join_conversation', async (data) => {
    try {
      const { conversationId } = data;

      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Verify user has access to conversation
      const result = await profileService.getUserConversations(socket.userId);

      if (!result.success) {
        socket.emit('error', { message: 'Access denied' });
        return;
      }

      const userConversations = result.data.conversations;
      const hasAccess = userConversations.some(conv => conv.id === conversationId);

      if (!hasAccess) {
        socket.emit('error', { message: 'Access denied to conversation' });
        return;
      }

      socket.join(`conversation_${conversationId}`);
      console.log(`📱 User ${socket.avatarName} joined conversation ${conversationId}`);

      socket.emit('conversation_joined', {
        conversationId,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Join conversation error:', error);
      socket.emit('error', { message: 'Failed to join conversation' });
    }
  });

  socket.on('leave_conversation', (data) => {
    const { conversationId } = data;
    socket.leave(`conversation_${conversationId}`);
    console.log(`📱 User ${socket.avatarName} left conversation ${conversationId}`);
  });

  socket.on('send_message', async (data) => {
    try {
      const { conversationId, message, messageType, localMessageId, contentHash } = data;

      if (!socket.userId) {
        socket.emit('error', { message: 'Not authenticated' });
        return;
      }

      // Record message metadata
      const result = await require('./services/chat/chatService').recordMessageMetadata({
        conversationId,
        senderId: socket.userId,
        messageType: messageType || 'text',
        localMessageId,
        contentHash,
        metadata: {
          socketId: socket.id,
          timestamp: new Date().toISOString()
        }
      });

      if (!result.success) {
        socket.emit('message_error', { message: result.message });
        return;
      }

      // Broadcast to conversation room (content stays local)
      io.to(`conversation_${conversationId}`).emit('new_message', {
        conversationId,
        senderId: socket.userId,
        senderAvatar: socket.avatarName,
        messageType: messageType || 'text',
        localMessageId,
        contentHash,
        timestamp: new Date().toISOString(),
        metadata: result.data.messageMetadata
      });

    } catch (error) {
      console.error('Send message error:', error);
      socket.emit('message_error', { message: 'Failed to send message' });
    }
  });

  socket.on('typing_start', (data) => {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      avatarName: socket.avatarName,
      isTyping: true
    });
  });

  socket.on('typing_stop', (data) => {
    const { conversationId } = data;
    socket.to(`conversation_${conversationId}`).emit('user_typing', {
      userId: socket.userId,
      avatarName: socket.avatarName,
      isTyping: false
    });
  });

  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedUsers.delete(socket.userId);

      // Broadcast user offline status
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        avatarName: socket.avatarName,
        timestamp: new Date().toISOString()
      });

      console.log(`🔌 User disconnected: ${socket.avatarName} (${socket.id})`);
    }
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);

  if (error.type === 'entity.parse.failed') {
    return APIResponse.send(res, APIResponse.error('Invalid JSON in request body', 400));
  }

  if (error.type === 'entity.too.large') {
    return APIResponse.send(res, APIResponse.error('Request entity too large', 413));
  }

  APIResponse.send(res, APIResponse.error('Internal server error', 500));
});

// 404 handler
app.use((req, res) => {
  APIResponse.send(res, APIResponse.notFound('Endpoint'));
});

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');

  try {
    // Close all Socket.IO connections
    io.close(() => {
      console.log('📡 Socket.IO connections closed');
    });

    // Cleanup expired sessions
    await authService.cleanupExpiredData();
    console.log('🧹 Expired data cleaned up');

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received');
  process.emit('SIGTERM');
});

// Memory monitoring for Railway
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };

    // Restart if memory usage is too high
    if (memUsageMB.heapUsed > 150) {
      console.error('🚨 High memory usage detected, restarting...');
      process.emit('SIGTERM');
    }
  }, 30000); // Check every 30 seconds
}

// Start server
const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 ChitChat API Gateway running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
  console.log(`📡 Socket.IO enabled for real-time features`);
  console.log(`🔒 Security: Helmet + CORS enabled`);
  console.log(`🗜️  Compression: Enabled`);
});

// Export for testing
module.exports = { app, server, io };
