# GUPT - Secure P2P Encrypted Chat System

A secure, end-to-end encrypted peer-to-peer messaging application built with Node.js, Socket.IO, and modern web technologies.

## Features

- 🔒 **End-to-End Encryption**: Messages are encrypted before transmission
- 👤 **Anonymous Identity**: Users communicate via generated avatars
- 📧 **OTP Authentication**: Secure email-based authentication
- 🔐 **P2P Messaging**: Direct peer-to-peer communication
- 📁 **Secure File Storage**: Encrypted file sharing capabilities
- 🌐 **Real-time Communication**: Instant messaging with Socket.IO

## Tech Stack

- **Backend**: Node.js, Express.js, Socket.IO
- **Database**: MongoDB with Mongoose
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Encryption**: CryptoJS, custom encryption utilities
- **Email Service**: Nodemailer

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB database
- Email service credentials (Gmail recommended)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd gupt
```

2. Install backend dependencies:
```bash
cd backend
npm install
```

3. Set up environment variables:
Create a `.env` file in the backend directory:
```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/gupt
JWT_SECRET=your-super-secret-jwt-key-here
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
EMAIL_FROM=noreply@gupt.com
```

4. Start the development server:
```bash
npm run dev
```

5. Open your browser to `http://localhost:3000`

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

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `NODE_ENV` | Environment mode | No | `development` |
| `PORT` | Server port | No | `3000` |
| `MONGODB_URI` | MongoDB connection string | Yes | - |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `EMAIL_USER` | Email service username | Yes | - |
| `EMAIL_PASS` | Email service password | Yes | - |
| `SMTP_HOST` | SMTP server host | No | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | No | `587` |
| `EMAIL_FROM` | From email address | No | - |

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
