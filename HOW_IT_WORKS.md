# How This App Works

This document explains how the ChitChat (DOOT) app is structured and how to run it locally (backend, web client, and mobile). It includes the main runtime flow and pointers to key files to inspect.

---

**Overview:**

- The project is a real-time, end-to-end encrypted chat application with audio/video calling.
- Backend: Node.js + Express + Socket.IO for signaling and messaging.
- Client: React (Vite) web app in `client/` that uses WebRTC for P2P audio/video.
- Mobile: React Native app in `mobile/` sharing similar services.

---

**Quick Requirements**

- Node.js 18+ (see [backend/package.json](backend/package.json)).
- npm or yarn.
- (Optional) MongoDB if you want persistent storage.

---

**Important environment variables**
Set these for the backend (examples):

- `MONGODB_URI` or `MONGO_URI` — MongoDB connection string (optional; code falls back to in-memory behavior).
- `PORT` — Backend port (default 3000).
- `NODE_ENV` — `development` or `production`.
- `EMAIL_USER`, `EMAIL_PASS`, `SMTP_HOST`, `SMTP_PORT`, `EMAIL_FROM` — Email credentials (optional; uses Ethereal test account if missing).
- `FRONTEND_URL`, `RAILWAY_PUBLIC_DOMAIN`, `RAILWAY_STATIC_URL` — optional deployment URLs used by CORS config.

---

**Run locally — Backend**

1. Install dependencies and start server:

```bash
cd backend
npm install
npm run dev    # uses nodemon, or npm start for production
```

2. The server entry is [backend/server.js](backend/server.js). Key behaviors:

- Socket.IO is initialized here for real-time messaging and signaling.
- WebRTC signaling handlers are wired via [backend/src/utils/webrtcHandler.js](backend/src/utils/webrtcHandler.js).
- Socket connection and chat handlers are in [backend/src/utils/socketHandler.js](backend/src/utils/socketHandler.js).

---

**Run locally — Web Client**

1. Install and start the Vite React app:

```bash
cd client
npm install
npm run dev
```

2. The main app entry is [client/src/main.jsx](client/src/main.jsx). UI components of interest:

- Call UI: [client/src/components/CallView.jsx](client/src/components/CallView.jsx)
- Chat UI: [client/src/components/chat/ChatView.jsx](client/src/components/chat/ChatView.jsx)
- Auth: [client/src/components/auth/AuthView.jsx](client/src/components/auth/AuthView.jsx)

3. Client services used to talk to the backend and handle media:

- REST/socket API wrapper: [client/src/services/api.js](client/src/services/api.js)
- Socket client: [client/src/services/socket.js](client/src/services/socket.js)
- WebRTC helpers: [client/src/services/webrtc.js](client/src/services/webrtc.js)

---

**Run locally — Mobile (React Native / Expo)**

1. Install and start the mobile app (Expo or react-native CLI depending on project setup):

```bash
cd mobile
npm install
# For Expo: npm run start (or expo start)
# For react-native CLI: follow your native build steps
```

2. Mobile entry: [mobile/App.js](mobile/App.js). Mobile services mirror the web services in `mobile/src/services/`.

---

**Runtime Flow (high level)**

1. User opens the client (web or mobile) and requests an OTP / logs in via `/api/auth`.
2. Backend (`/api/auth`) validates, creates user record if needed, and optionally emails OTP via the email service ([backend/src/config/emailService.js](backend/src/config/emailService.js)).
3. After authentication, the client connects to Socket.IO on the server (configured in [backend/server.js](backend/server.js)).
4. For messaging, events are exchanged over Socket.IO to route messages and maintain presence.
5. For audio/video calls, clients use WebRTC; signaling messages (offer/answer/ICE) are exchanged over Socket.IO. The WebRTC signaling wiring lives in [backend/src/utils/webrtcHandler.js](backend/src/utils/webrtcHandler.js) and the client service in [client/src/services/webrtc.js](client/src/services/webrtc.js).

---

**Key files to inspect**

- Backend entry: [backend/server.js](backend/server.js)
- DB config: [backend/src/config/database.js](backend/src/config/database.js)
- Email & OTP flows: [backend/src/config/emailService.js](backend/src/config/emailService.js)
- Auth routes: [backend/src/routes/auth.js](backend/src/routes/auth.js)
- Socket handlers: [backend/src/utils/socketHandler.js](backend/src/utils/socketHandler.js)
- WebRTC signaling: [backend/src/utils/webrtcHandler.js](backend/src/utils/webrtcHandler.js)
- Client call UI: [client/src/components/CallView.jsx](client/src/components/CallView.jsx)
- Client socket & webRTC services: [client/src/services/socket.js](client/src/services/socket.js), [client/src/services/webrtc.js](client/src/services/webrtc.js)

---

**Quick smoke tests**

- Start the backend and client, open two browser windows, sign in with two different avatars, and send messages — messages should appear in real time.
- Start a call from one client and accept on the other — audio/video should connect (check browser console for signaling logs).
- If email is required for OTP and you have not set `EMAIL_USER`/`EMAIL_PASS`, the server will create an Ethereal test account and print a preview URL (see console logs).

---

**Troubleshooting tips**

- If sockets fail to connect: check CORS origins and that the backend `PORT` is reachable.
- If WebRTC fails: ensure clients can reach each other (NAT/ICE issues) and check ICE candidate logs in browser console.
- If emails do not send: set `SMTP_HOST`, `SMTP_PORT`, `EMAIL_USER`, `EMAIL_PASS`, or use Ethereal preview.

---

If you'd like, I can:

- Add a small `env.example` with the env vars shown above.
- Add a short script to run backend+client concurrently.
- Walk through a live run and troubleshoot any local errors.

File created: [HOW_IT_WORKS.md](HOW_IT_WORKS.md)
