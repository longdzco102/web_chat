/**
 * src/app.js – Express + Socket.io application entry point
 *
 * Start:  npm run dev  (nodemon)
 *         npm start    (production)
 */
'use strict';
require('dotenv').config();

const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const cors       = require('cors');
const path       = require('path');
const logger     = require('./utils/logger');

// ── Init ─────────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin:  (process.env.CORS_ORIGIN || 'http://localhost:5500').split(','),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingTimeout:  20000,
  pingInterval: 25000,
});
app.set('io', io);
require('./sockets')(io);   // register all socket handlers

// ── Express Middlewares ───────────────────────────────────────
app.use(cors({
  origin: (process.env.CORS_ORIGIN || 'http://localhost:5500').split(','),
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// HTTP request logger
app.use((req, _res, next) => {
  req._startAt = Date.now();
  next();
});
app.use((req, res, next) => {
  res.on('finish', () => {
    logger.http(req.method, req.originalUrl, res.statusCode, Date.now() - req._startAt);
  });
  next();
});

// ── Static (serve frontend) ───────────────────────────────────
app.use(express.static(path.join(__dirname, '../../frontend')));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/posts',         require('./routes/posts'));
app.use('/api/sects',         require('./routes/sects'));
app.use('/api/channels',      require('./routes/channels'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/dms',           require('./routes/dm'));
app.use('/api/blocks',        require('./routes/block'));
app.use('/api/friends',       require('./routes/friend'));

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: process.env.NODE_ENV, ts: new Date().toISOString() });
});

// ── SPA fallback ──────────────────────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/index.html'));
});

// ── Error handlers (must come last) ──────────────────────────
const { notFound, errorHandler } = require('./middlewares/errorHandler');
app.use(notFound);
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);
server.listen(PORT, () => {
  logger.ok(`🚀 Server  → http://localhost:${PORT}`);
  logger.ok(`⚡ Socket  → ws://localhost:${PORT}`);
  logger.ok(`🌍 Env     → ${process.env.NODE_ENV || 'development'}`);
});

// ── Graceful shutdown ─────────────────────────────────────────
process.on('SIGTERM', () => {
  logger.warn('SIGTERM received – shutting down...');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io }; // for testing
