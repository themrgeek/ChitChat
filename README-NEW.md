# ChitChat v2.0 - Microservice Architecture

A secure, real-time, end-to-end encrypted messaging system built with Node.js, Supabase PostgreSQL, and Socket.IO.

## 🚀 What's New in v2.0

- **Microservice Architecture**: Separated concerns into Auth, Profile, Chat, and Email services
- **Supabase PostgreSQL**: Robust user management and data persistence
- **JWT Session Management**: Proper authentication and session handling
- **Profile System**: User profiles with conversation history
- **Local Content Storage**: Safe content stays encrypted on device
- **Performance Optimized**: Caching, connection pooling, background processing

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   API Gateway   │    │   Supabase      │    │   Frontend      │
│   (Express)     │◄──►│   PostgreSQL    │    │   (Vanilla JS)  │
│                 │    │   Database      │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Auth Service   │    │ Profile Service │    │  Chat Service   │
│  (JWT, OTP)     │    │ (Users, Convs)  │    │  (Messages)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │
         ▼
┌─────────────────┐
│ Email Service   │
│ (Ethereal SMTP) │
└─────────────────┘
```

## 📋 Prerequisites

- Node.js 18+
- Supabase account
- Railway account (for deployment)
- Ethereal email account (for testing)

## 🔧 Setup Instructions

### 1. Clone and Install

```bash
git clone <repository-url>
cd ChitChat
npm install
```

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `backend/database/schema.sql`
3. Get your project URL and API keys from Settings > API

### 3. Environment Configuration

Create a `.env` file in the backend directory:

```bash
# Server
NODE_ENV=production
PORT=3000
FRONTEND_URL=https://your-frontend-domain.com

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-super-secure-jwt-secret-here-make-it-long

# Email Configuration (Required - SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
EMAIL_FROM=your-gmail@gmail.com
```

### 4. Database Migration (if upgrading from v1.0)

```bash
# Migrate existing users to Supabase
npm run migrate

# Or with cleanup of old files
npm run migrate -- --cleanup
```

### 5. Start the Application

```bash
# Development
npm run dev

# Production
npm start

# Legacy server (v1.0)
npm run start:legacy
```

## 📡 API Endpoints

### Authentication Service (`/api/auth`)
- `POST /api/auth/send-otp` - Send OTP for registration
- `POST /api/auth/verify-otp` - Verify OTP and create account
- `POST /api/auth/login` - Login with credentials
- `POST /api/auth/logout` - Logout and invalidate session
- `GET /api/auth/validate-session` - Validate current session

### Profile Service (`/api/profile`)
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update profile
- `GET /api/profile/conversations` - Get user conversations
- `POST /api/profile/conversations` - Create conversation
- `GET /api/profile/search` - Search users
- `GET /api/profile/stats` - Get user statistics

### Chat Service (`/api/chat`)
- `POST /api/chat/messages` - Record message metadata
- `GET /api/chat/conversations/:id/messages` - Get conversation messages
- `PUT /api/chat/conversations/:id/read` - Mark messages read
- `GET /api/chat/unread` - Get unread counts

### Email Service (`/api/email`)
- `GET /api/email/health` - Email service health check
- `POST /api/email/send-otp` - Send OTP email
- `POST /api/email/send-credentials` - Send credentials email

## 🔐 Security Features

- **JWT Authentication**: Secure session management with expiration
- **Row Level Security**: Database-level access control
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configured for secure cross-origin requests
- **Helmet Security**: Security headers and protections

## 🚀 Performance Optimizations

- **LRU Caching**: Multi-level caching for users, sessions, and profiles
- **Connection Pooling**: Efficient database connections
- **Background Processing**: Non-blocking email and message processing
- **Compression**: Response compression for faster loading
- **Memory Monitoring**: Automatic restart on high memory usage

## 💾 Data Storage Strategy

### In Supabase (Database)
- User accounts and authentication data
- Session management
- User profiles and preferences
- Conversation metadata (titles, participants, etc.)
- Message metadata (timestamps, hashes, etc.)

### Local Storage (Device)
- Actual message content (end-to-end encrypted)
- Chat history and conversations
- User preferences (synced with database)
- Encryption keys and certificates

## 🔄 Migration from v1.0

1. **Backup your data** (automatic backup created during migration)
2. **Set up Supabase** and run the schema
3. **Configure environment variables**
4. **Run migration script**: `npm run migrate`
5. **Test the new system**
6. **Deploy to production**

## 📊 Monitoring and Health Checks

- **Health Endpoint**: `GET /health` - Overall system health
- **Email Health**: `GET /api/email/health` - Email service status
- **Performance Metrics**: Built-in response time logging
- **Memory Monitoring**: Automatic restart on memory issues

## 🚀 Deployment to Railway

1. Connect your GitHub repository to Railway
2. Set environment variables in Railway dashboard
3. Deploy automatically on git push
4. Monitor logs and health checks

### Railway Environment Variables

```
NODE_ENV=production
PORT=${PORT}
FRONTEND_URL=https://your-app.railway.app
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_secret
ETHEREAL_USER=your_ethereal_user
ETHEREAL_PASS=your_ethereal_pass
```

## 🧪 Development

```bash
# Run with auto-restart
npm run dev

# Run legacy version for comparison
npm run start:legacy

# Test email service
curl http://localhost:3000/api/email/health
```

## 📝 Key Differences from v1.0

| Feature | v1.0 (Database-less) | v2.0 (Supabase) |
|---------|---------------------|-----------------|
| Users | In-memory | PostgreSQL |
| Sessions | Basic | JWT with expiration |
| Persistence | File-based | Database |
| Scalability | Single instance | Multi-instance ready |
| Performance | Fast but limited | Optimized with caching |
| Reliability | Restarts lose data | Persistent data |
| Features | Basic chat | Full profile system |

## 🤝 Contributing

1. Follow the microservice architecture patterns
2. Add comprehensive error handling
3. Include proper logging
4. Test with the health check endpoints
5. Update documentation

## 📄 License

MIT License - see LICENSE file for details.

---

**ChitChat v2.0** - Secure, scalable, real-time messaging for the modern web.
