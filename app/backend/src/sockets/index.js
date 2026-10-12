/**
 * sockets/index.js
 * Bootstraps Socket.io: authentication middleware + handler registration.
 */
const jwtHelper = require('../config/jwt');
const User      = require('../models/User');
const logger    = require('../utils/logger');

const registerChatHandlers     = require('./chatHandler');
const registerPresenceHandlers = require('./presenceHandler');
const registerVoiceHandlers    = require('./voiceHandler');

/**
 * @param {import('socket.io').Server} io
 */
module.exports = function initSockets(io) {

  // ── Socket.io Auth Middleware ───────────────────────────────
  // Clients must send: { auth: { token: '<JWT>' } }
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token
               || socket.handshake.headers?.authorization?.replace('Bearer ', '');

    if (!token) {
      return next(new Error('Socket auth: token bắt buộc'));
    }
    try {
      const payload = jwtHelper.verify(token);
      const user    = await User.findById(payload.id);
      if (!user) return next(new Error('Socket auth: tài khoản không tồn tại'));
      socket.data.user = user;   // attach user to socket
      next();
    } catch {
      next(new Error('Socket auth: token không hợp lệ'));
    }
  });

  // ── Connection handler ──────────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.data.user;
    logger.ok(`[socket] connected  id=${socket.id}  user=${user.id} (${user.name})`);

    // Register domain handlers
    registerChatHandlers(io, socket);
    registerPresenceHandlers(io, socket);
    registerVoiceHandlers(io, socket);

    // Generic error catch per socket
    socket.on('error', (err) => {
      logger.error(`[socket] error user=${user.id}`, err.message);
    });
  });

  logger.info('[socket] Socket.io handlers registered');
};
