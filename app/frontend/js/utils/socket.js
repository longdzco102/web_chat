/**
 * utils/socket.js – Socket.io client singleton
 *
 * Usage:
 *   import { connectSocket, getSocket } from './utils/socket.js';
 *   connectSocket(token);
 *   getSocket().emit('channel:join', { channelId });
 */

const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const SERVER_URL = isLocal ? 'http://localhost:3000' : '/';

let _socket = null;

/**
 * Connect (or reconnect) to Socket.io server with a JWT token.
 * @param {string} token – JWT from AuthController login response
 * @returns {import('socket.io-client').Socket}
 */
export function connectSocket(token) {
  if (_socket?.connected) return _socket;

  // socket.io-client loaded via CDN in index.html
  _socket = window.io(SERVER_URL, {
    auth:        { token },
    transports:  ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1500,
    reconnectionAttempts: 10,
  });

  _socket.on('connect', () => {
    console.log('%c⚡ Socket connected', 'color:#2DD4BF;font-weight:700;');
  });
  _socket.on('disconnect', (reason) => {
    console.warn('[socket] disconnected:', reason);
  });
  _socket.on('connect_error', (err) => {
    console.error('[socket] connect error:', err.message);
  });

  return _socket;
}

/** Get current socket instance (null if not connected) */
export function getSocket() { return _socket; }

/** Disconnect and clear instance */
export function disconnectSocket() {
  _socket?.disconnect();
  _socket = null;
}
