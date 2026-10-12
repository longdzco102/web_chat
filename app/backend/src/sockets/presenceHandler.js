/**
 * sockets/presenceHandler.js
 * Tracks user online/offline status and broadcasts to sect rooms.
 *
 * Room: sect:<sectId>  – all members of a sect share this room
 */
const Sect   = require('../models/Sect');
const User   = require('../models/User');
const logger = require('../utils/logger');

module.exports = function registerPresenceHandlers(io, socket) {
  const userId = socket.data.user.id;
  const user   = socket.data.user;

  // ── On connect: join all sect rooms the user belongs to ──
  async function joinSectRooms() {
    try {
      socket.join(`user:${userId}`); // Join personal notification room
      const sects = await Sect.findAll(userId);
      for (const sect of sects) {
        const room = `sect:${sect.id}`;
        socket.join(room);
        // Notify other members this user is online
        socket.to(room).emit('user:online', {
          userId,
          name:   user.name,
          avatar: user.avatar_url,
          realm:  user.realm,
          status: 'online',
        });
      }
      await User.setStatus(userId, 'online');
      logger.info(`[presence] user ${userId} (${user.name}) is online`);
    } catch (e) {
      logger.error('[presence] joinSectRooms error', e.message);
    }
  }

  // ── Join a specific sect room (after creating/joining a sect) ──
  socket.on('sect:join', async ({ sectId }) => {
    const room = `sect:${sectId}`;
    socket.join(room);
    const members = await Sect.getMembers(sectId).catch(() => []);
    socket.to(room).emit('user:online', {
      userId, name: user.name, avatar: user.avatar_url, realm: user.realm, status: 'online',
    });
    // Send current member list back to joining user
    socket.emit('sect:member_list', { sectId, members });
  });

  // ── Status change (away / busy / online) ──────────────────
  socket.on('user:status', async ({ status }) => {
    const allowed = ['online', 'away', 'busy'];
    if (!allowed.includes(status)) return;
    await User.setStatus(userId, status).catch(() => {});
    // Broadcast to all sect rooms
    for (const room of socket.rooms) {
      if (room.startsWith('sect:')) {
        io.to(room).emit('user:status_change', { userId, status });
      }
    }
  });

  // ── On disconnect: mark offline, notify sect rooms ─────────
  socket.on('disconnect', async (reason) => {
    logger.info(`[presence] user ${userId} disconnected (${reason})`);
    await User.setStatus(userId, 'offline').catch(() => {});
    for (const room of socket.rooms) {
      if (room.startsWith('sect:')) {
        io.to(room).emit('user:offline', { userId });
      }
    }
  });

  // Start joining rooms immediately on connection
  joinSectRooms();
};
