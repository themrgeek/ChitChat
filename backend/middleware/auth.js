const Session = require("../models/Session");

const authenticateSocket = async (socket, next) => {
  try {
    const { sessionId } = socket.handshake.auth;

    if (!sessionId) {
      return next(new Error("Authentication error: No session ID provided"));
    }

    const session = await Session.findOne({
      sessionId,
      isActive: true,
    }).populate("user");

    if (!session) {
      return next(new Error("Authentication error: Invalid session"));
    }

    // Attach user and session to socket
    socket.userId = session.user._id;
    socket.anonymousId = session.user.anonymousId;
    socket.sessionId = sessionId;
    socket.avatar = session.avatar;

    // Update session activity
    session.lastActivity = new Date();
    await session.save();

    next();
  } catch (error) {
    next(new Error("Authentication error: " + error.message));
  }
};

const authenticateAPI = async (req, res, next) => {
  try {
    const sessionId = req.headers["x-session-id"];

    if (!sessionId) {
      return res.status(401).json({ error: "No session ID provided" });
    }

    const session = await Session.findOne({
      sessionId,
      isActive: true,
    }).populate("user");

    if (!session) {
      return res.status(401).json({ error: "Invalid session" });
    }

    // Attach user and session to request
    req.user = session.user;
    req.session = session;

    // Update session activity
    session.lastActivity = new Date();
    await session.save();

    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication error" });
  }
};

module.exports = { authenticateSocket, authenticateAPI };
