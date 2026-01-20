# ChitChat - Secure P2P Encrypted Chat System

A secure, end-to-end encrypted peer-to-peer messaging application built with Node.js, Socket.IO, and modern web technologies.

## Features

- 🔒 **End-to-End Encryption**: Messages are encrypted before transmission
- 👤 **Anonymous Identity**: Users communicate via generated avatars
- 📧 **OTP Authentication**: Secure email-based authentication
- 🔐 **P2P Messaging**: Direct peer-to-peer communication
- 📁 **Secure File Storage**: Encrypted file sharing capabilities
- 🌐 **Real-time Communication**: Instant messaging with Socket.IO

## ⚖️ Usage Guidelines & Legal Compliance

### ✅ Acceptable Use

DOOT is designed for **legitimate personal and professional communication**. Permitted activities include:

- Personal messaging and communication
- Professional collaboration and document sharing
- Educational discussions and knowledge sharing
- Legal and compliant business activities
- Privacy-conscious communication needs

### 🚫 Prohibited Activities

The following activities are strictly prohibited and will result in immediate account termination:

- **Illegal Content**: Distribution of child exploitation material, illegal drugs, stolen intellectual property, malware, or other prohibited content
- **Illegal Activities**: Planning, coordinating, or facilitating criminal activities
- **Harassment**: Threats, abusive behavior, or harassment of any kind
- **Copyright Violations**: Sharing copyrighted material without explicit permission
- **Impersonation**: Misrepresenting identity or affiliation
- **Spam**: Unsolicited commercial messaging or spam
- **System Abuse**: Attempting to breach security or disrupt service
- **Fraud**: Using the platform for fraudulent purposes

### 📋 Content Guidelines

- **File Sharing**: Maximum 10MB per file. Only permitted formats for personal/professional use
- **Messages**: Must comply with applicable laws and regulations
- **Copyright**: Only share content you own or have permission to distribute
- **Privacy**: Respect others' privacy and data protection rights

### 🛡️ Legal Compliance

This service operates in compliance with applicable laws and regulations. Users are responsible for ensuring their use complies with local laws in their jurisdiction. Any illegal use may result in account termination and potential legal action.

**By using DOOT, you agree to use it only for legitimate purposes and comply with our Terms of Service.**

## Tech Stack

- **Backend**: Node.js, Express.js, Socket.IO
- **Database**: MongoDB with Mongoose
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Encryption**: CryptoJS, custom encryption utilities
- **Email Service**: Nodemailer

## Quick Start

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- (Optional) MongoDB database for persistent storage

### Local Development

1. Clone the repository:

```bash
git clone <repository-url>
cd ChitChat-VERSION-101-WEB
```

2. Install dependencies:

```bash
cd backend
npm install
```

3. Set up environment variables:
   Create a `.env` file in the backend directory (copy from `.env.example`):

```env
NODE_ENV=development
PORT=3000
JWT_SECRET=your-super-secret-jwt-key-here
```

4. Start the development server:

```bash
npm run dev
```

5. Open your browser to `http://localhost:3000`

## 🚀 Deployment to Railway

### Option 1: One-Click Deploy (Recommended)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Click the button above or go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your ChitChat repository
4. Railway will auto-detect the configuration and deploy

### Option 2: Railway CLI

1. **Install Railway CLI**:

```bash
npm install -g @railway/cli
```

2. **Login to Railway**:

```bash
railway login
```

3. **Initialize project** (from project root):

```bash
railway init
```

4. **Deploy**:

```bash
railway up
```

### Option 3: Manual Configuration

1. Go to [railway.app](https://railway.app) and create a new project
2. Connect your GitHub repository
3. Railway will automatically detect the `railway.json` configuration
4. Set the required environment variables in the Railway dashboard

### Environment Variables for Railway

Set these in your Railway project settings:

| Variable     | Description                  | Required |
| ------------ | ---------------------------- | -------- |
| `NODE_ENV`   | Set to `production`          | Yes      |
| `JWT_SECRET` | Secure random string for JWT | Yes      |
| `EMAIL_USER` | Email service username       | Optional |
| `EMAIL_PASS` | Email service password       | Optional |

> **Note**: The app uses Ethereal Email by default for testing, so email credentials are optional for demo purposes.

### Post-Deployment

After deployment, Railway will provide you with a public URL like:

- `https://your-app-name.up.railway.app`

The app automatically:

- Detects the production environment
- Configures WebSocket connections correctly
- Serves both API and frontend from the same domain

## Deployment to Render

### Option 1: Using render.yaml (Recommended)

1. **Connect your repository** to Render
2. **Set environment variables** in Render dashboard:
   - `NODE_ENV=production`
   - `MONGODB_URI` - Your MongoDB connection string
   - `JWT_SECRET` - A secure random string for JWT signing
   - `EMAIL_USER` - Your email service username
   - `EMAIL_PASS` - Your email service password/app key
   - `SMTP_HOST` - Email SMTP host (default: smtp.gmail.com)
   - `SMTP_PORT` - Email SMTP port (default: 587)
   - `EMAIL_FROM` - From email address

3. **Deploy** - Render will automatically detect the `render.yaml` file and configure the service

### Option 2: Manual Configuration

1. Create a new **Web Service** on Render
2. Connect your repository
3. Set the following:
   - **Runtime**: Node.js
   - **Build Command**: `npm run build` (optional)
   - **Start Command**: `npm start`
   - **Plan**: Free tier works for development

4. Configure the environment variables as listed above

## Environment Variables

| Variable      | Description               | Required | Default          |
| ------------- | ------------------------- | -------- | ---------------- |
| `NODE_ENV`    | Environment mode          | No       | `development`    |
| `PORT`        | Server port               | No       | `3000`           |
| `MONGODB_URI` | MongoDB connection string | Yes      | -                |
| `JWT_SECRET`  | JWT signing secret        | Yes      | -                |
| `EMAIL_USER`  | Email service username    | Yes      | -                |
| `EMAIL_PASS`  | Email service password    | Yes      | -                |
| `SMTP_HOST`   | SMTP server host          | No       | `smtp.gmail.com` |
| `SMTP_PORT`   | SMTP server port          | No       | `587`            |
| `EMAIL_FROM`  | From email address        | No       | -                |

## API Endpoints

### Authentication

- `POST /api/auth/send-otp` - Send OTP to email
- `POST /api/auth/verify-otp` - Verify OTP and create user
- `POST /api/auth/login` - Avatar login

### Chat

- `POST /api/chat/session` - Create chat session
- `POST /api/chat/message` - Send encrypted message
- `GET /api/chat/messages` - Get chat history

## Security Features

- **End-to-End Encryption**: All messages are encrypted client-side
- **OTP Authentication**: One-time passwords for secure access
- **Anonymous Communication**: Users identified by generated avatars
- **Secure File Storage**: Files are encrypted before storage
- **Session Management**: Secure session establishment

## Development

### Project Structure

```
gupt/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── utils/
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── css/
│   ├── js/
│   └── index.html
├── render.yaml
└── README.md
```

### Available Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run build` - Build for production (no-op for now)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support or questions, please open an issue on the GitHub repository.
