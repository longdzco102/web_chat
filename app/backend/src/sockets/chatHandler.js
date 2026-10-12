/**
 * sockets/chatHandler.js
 * Handles real-time messaging with:
 * - Sticker support (type: 'sticker')
 * - EXP cooldown (1 msg per minute rewards EXP)
 * - Breakthrough system (request_breakthrough event)
 * - World broadcast on successful breakthrough
 */
const Message = require('../models/Message');
const Channel = require('../models/Channel');
const Sect    = require('../models/Sect');
const User    = require('../models/User');
const logger  = require('../utils/logger');
const {
  REALM_SYSTEM,
  getRealmByIndex,
  EXP_PER_MESSAGE,
  EXP_COOLDOWN_MS,
  BREAKTHROUGH_SUCCESS_RATE,
  BREAKTHROUGH_FAIL_PENALTY,
} = require('../config/realmSystem');

// In-memory cooldown store: userId → lastExpGrantedAt (ms)
const userCooldowns = new Map();

module.exports = function registerChatHandlers(io, socket) {
  const userId = socket.data.user.id;

  // ── Join a channel room ──────────────────────────────
  socket.on('channel:join', async ({ channelId }, ack) => {
    try {
      const ch = await Channel.findById(channelId);
      if (!ch) return ack?.({ error: 'Kênh không tồn tại' });

      const isMember = await Sect.isMember(ch.sect_id, userId);
      if (!isMember) return ack?.({ error: 'Bạn không thuộc tông môn này' });

      const room = `channel:${channelId}`;
      socket.join(room);
      logger.info(`[chat] user ${userId} joined room ${room}`);

      const messages = await Message.findByChannel(channelId, 50);
      ack?.({ ok: true, messages });
    } catch (e) {
      logger.error('[chat] channel:join error', e.message);
      ack?.({ error: 'Lỗi server' });
    }
  });

  // ── Leave a channel room ─────────────────────────────
  socket.on('channel:leave', ({ channelId }) => {
    socket.leave(`channel:${channelId}`);
  });

  // ── Send a message (text or sticker) ────────────────
  socket.on('message:send', async ({ channelId, content, type = 'text' }, ack) => {
    try {
      if (!content?.trim()) return ack?.({ error: 'Nội dung không được trống' });

      const ch = await Channel.findById(channelId);
      if (!ch) return ack?.({ error: 'Kênh không tồn tại' });

      const isMember = await Sect.isMember(ch.sect_id, userId);
      if (!isMember) return ack?.({ error: 'Không có quyền gửi tin nhắn' });

      // Validate type
      const msgType = ['text', 'sticker'].includes(type) ? type : 'text';

      const msg = await Message.create({
        channel_id: channelId,
        user_id:    userId,
        content:    content.trim(),
        type:       msgType,
      });

      // Broadcast to everyone in room (including sender)
      io.to(`channel:${channelId}`).emit('message:new', msg);

      // ── EXP Cooldown Logic ─────────────────────────
      // Only grant EXP for text messages (not spamming stickers for exp)
      if (msgType === 'text') {
        const now      = Date.now();
        const lastTime = userCooldowns.get(userId) || 0;

        if (now - lastTime > EXP_COOLDOWN_MS) {
          userCooldowns.set(userId, now);

          // Grant EXP and check for realm up
          const result = await User.gainExp(userId, EXP_PER_MESSAGE);
          socket.emit('user:exp_update', result);

          logger.info(`[exp] user ${userId} gained ${EXP_PER_MESSAGE} EXP → ${result.exp}/${result.maxExp}`);
        }
      }

      ack?.({ ok: true, message: msg });
    } catch (e) {
      logger.error('[chat] message:send error', e.message);
      ack?.({ error: 'Lỗi gửi tin nhắn' });
    }
  });

  // ── Typing indicator ─────────────────────────────────
  socket.on('typing:start', ({ channelId }) => {
    if (String(channelId).startsWith('dm:')) {
      const targetUserId = channelId.split(':')[1];
      socket.to(`user:${targetUserId}`).emit('typing:start', {
        userId,
        name: socket.data.user.name,
        channelId: `dm:${userId}` // for the recipient, the channel is dm:userId
      });
    } else {
      socket.to(`channel:${channelId}`).emit('typing:start', {
        userId,
        name: socket.data.user.name,
        channelId
      });
    }
  });
  socket.on('typing:stop', ({ channelId }) => {
    if (String(channelId).startsWith('dm:')) {
      const targetUserId = channelId.split(':')[1];
      socket.to(`user:${targetUserId}`).emit('typing:stop', { userId, channelId: `dm:${userId}` });
    } else {
      socket.to(`channel:${channelId}`).emit('typing:stop', { userId, channelId });
    }
  });

  // ── React to a message ───────────────────────────────
  socket.on('message:react', async ({ messageId, emoji }, ack) => {
    try {
      const result = await Message.toggleReaction(messageId, userId, emoji);
      const [rows] = await require('../config/db').execute(
        'SELECT channel_id FROM messages WHERE id=? LIMIT 1', [messageId]
      );
      if (rows[0]) {
        io.to(`channel:${rows[0].channel_id}`).emit('message:reaction_update', {
          messageId, ...result,
        });
      }
      ack?.({ ok: true, ...result });
    } catch (e) {
      logger.error('[chat] message:react error', e.message);
      ack?.({ error: 'Lỗi react' });
    }
  });

  // ── Breakthrough (Đột Phá Cảnh Giới) ────────────────
  socket.on('request_breakthrough', async (ack) => {
    try {
      const user = await User.findById(userId);
      if (!user) return ack?.({ error: 'Không tìm thấy người dùng' });

      const currentRealm = getRealmByIndex(user.realm_index ?? 0);
      const nextRealm    = REALM_SYSTEM[(user.realm_index ?? 0) + 1];

      // Must have enough EXP
      if ((user.exp ?? 0) < currentRealm.maxExp) {
        return ack?.({
          ok: false,
          error: `Cần ${currentRealm.maxExp} Linh Khí để đột phá ${currentRealm.name}`,
        });
      }

      // Max realm check
      if (!nextRealm) {
        return ack?.({ ok: false, error: 'Đã đạt Cảnh Giới tối thượng! 🌟' });
      }

      const roll = Math.random();

      if (roll <= BREAKTHROUGH_SUCCESS_RATE) {
        // ── 80% SUCCESS ──────────────────────────────
        const newIndex = (user.realm_index ?? 0) + 1;
        await User.breakthrough(userId, newIndex, nextRealm.name);

        const updatePayload = {
          exp:        0,
          realm:      nextRealm.name,
          realm_index: newIndex,
          maxExp:     nextRealm.maxExp,
          realmCss:   nextRealm.css,
          success:    true,
        };
        socket.emit('user:exp_update', updatePayload);

        // World broadcast
        io.emit('world_notice', {
          type:    'breakthrough',
          message: `⚡ ${user.name} vừa đột phá thành công lên ${nextRealm.name}!`,
          userName: user.name,
          realm:   nextRealm.name,
        });

        ack?.({ ok: true, success: true, realm: nextRealm.name });
        logger.info(`[breakthrough] user ${userId} → ${nextRealm.name}`);
      } else {
        // ── 20% FAIL ─────────────────────────────────
        const penalty = Math.min(BREAKTHROUGH_FAIL_PENALTY, user.exp ?? 0);
        const newExp  = Math.max(0, (user.exp ?? 0) - penalty);
        await User.setExp(userId, newExp);

        const updatePayload = {
          exp:        newExp,
          realm:      currentRealm.name,
          realm_index: user.realm_index ?? 0,
          maxExp:     currentRealm.maxExp,
          realmCss:   currentRealm.css,
          success:    false,
        };
        socket.emit('user:exp_update', updatePayload);
        ack?.({ ok: true, success: false, penalty });
        logger.info(`[breakthrough] user ${userId} FAILED, penalty ${penalty} EXP`);
      }
    } catch (e) {
      logger.error('[breakthrough] error', e.message);
      ack?.({ error: 'Lỗi server' });
    }
  });
};
