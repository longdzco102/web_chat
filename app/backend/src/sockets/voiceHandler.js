/**
 * sockets/voiceHandler.js
 * Handles WebRTC mesh voice signaling and session state for voice channels.
 * Room: voice-channel:<channelId>
 */
const Channel   = require('../models/Channel');
const Sect      = require('../models/Sect');
const UserBlock = require('../models/UserBlock');
const logger    = require('../utils/logger');

// In-memory sessions: channelId -> Map of socketId -> { userId, name, avatar, realm, socketId, micEnabled }
const voiceSessions = new Map();

// Map of socketId -> channelId (to quickly clean up on disconnect)
const socketToChannel = new Map();

module.exports = function registerVoiceHandlers(io, socket) {
  const userId = socket.data.user.id;
  const user   = socket.data.user;

  // Helper to resolve channel ID to unique 1-1 room name if it starts with dm:
  function resolveChannelId(channelId, myUserId) {
    if (channelId && String(channelId).startsWith('dm:')) {
      const targetUserId = parseInt(String(channelId).split(':')[1], 10);
      const myId = parseInt(myUserId, 10);
      if (!isNaN(targetUserId)) {
        const minId = Math.min(myId, targetUserId);
        const maxId = Math.max(myId, targetUserId);
        return `dm-voice:${minId}-${maxId}`;
      }
    }
    return channelId;
  }

  // ── Join Voice Channel ──────────────────────────────────────
  socket.on('voice:join', async ({ channelId }, ack) => {
    try {
      let resolvedChannelId = channelId;
      let maxUsers = 4;

      if (channelId && String(channelId).startsWith('dm:')) {
        const targetUserId = parseInt(String(channelId).split(':')[1], 10);
        const myId = parseInt(userId, 10);
        if (isNaN(targetUserId)) {
          return ack?.({ error: 'Đạo hữu không hợp lệ' });
        }

        // Check if either user blocked the other
        const isBlocked = await UserBlock.isBlocked(myId, targetUserId);
        if (isBlocked) {
          return ack?.({ error: 'Đối phương đang bế quan tĩnh tu, không thể thiết lập kết nối linh âm!' });
        }

        resolvedChannelId = resolveChannelId(channelId, userId);
        maxUsers = 2;
      } else {
        const ch = await Channel.findById(channelId);
        if (!ch) return ack?.({ error: 'Kênh thoại không tồn tại' });
        if (ch.type !== 'voice') return ack?.({ error: 'Đây không phải kênh thoại' });

        const isMember = await Sect.isMember(ch.sect_id, userId);
        if (!isMember) return ack?.({ error: 'Bạn không thuộc tông môn này' });
      }

      // Clean up previous voice channel if they were in one
      if (socketToChannel.has(socket.id)) {
        await leaveVoiceChannel(socketToChannel.get(socket.id));
      }

      if (!voiceSessions.has(resolvedChannelId)) {
        voiceSessions.set(resolvedChannelId, new Map());
      }
      const session = voiceSessions.get(resolvedChannelId);

      // Max users check
      if (session.size >= maxUsers) {
        return ack?.({ error: maxUsers === 2 ? 'Đàm đạo thoại đã đủ 2 người, trận pháp đầy!' : 'Đại điện linh âm đã đủ 4 người, trận pháp quá tải!' });
      }

      const avatarUrl = user.avatar_url 
        ? (user.avatar_url.startsWith('http') ? user.avatar_url : `http://localhost:3000${user.avatar_url}`)
        : '';

      const memberInfo = {
        userId,
        name:       user.name,
        avatar:     avatarUrl,
        realm:      user.realm || 'Luyện Khí Kỳ',
        realmCss:   user.realmCss || 'realm-1',
        socketId:   socket.id,
        micEnabled: true,
      };

      // Add to session
      session.set(socket.id, memberInfo);
      socketToChannel.set(socket.id, resolvedChannelId);

      const room = `voice-channel:${resolvedChannelId}`;
      socket.join(room);

      // Notify other users in the channel
      socket.to(room).emit('voice:user_joined', memberInfo);

      logger.info(`[voice] user ${userId} (${user.name}) joined voice channel ${resolvedChannelId} (total: ${session.size})`);

      // Respond with list of other users already in the channel
      const others = Array.from(session.values()).filter(u => typeof u === 'object' && u.socketId !== socket.id);
      
      // If DM call and it's 2 people, mark start time
      if (resolvedChannelId.startsWith('dm-voice:') && session.size === 2 && !session.startTime) {
        session.startTime = Date.now();
      }
      ack?.({ ok: true, users: others });
    } catch (e) {
      logger.error('[voice] voice:join error', e.message);
      ack?.({ error: 'Gặp chướng ngại khi vào trận pháp thoại' });
    }
  });

  // ── Leave Voice Channel ─────────────────────────────────────
  socket.on('voice:leave', async ({ channelId }, ack) => {
    try {
      const resolvedChannelId = resolveChannelId(channelId, userId);
      await leaveVoiceChannel(resolvedChannelId);
      ack?.({ ok: true });
    } catch (e) {
      logger.error('[voice] voice:leave error', e.message);
      ack?.({ error: 'Gặp chướng ngại khi thoát trận pháp thoại' });
    }
  });

  // Helper to leave voice channel
  async function leaveVoiceChannel(resolvedChannelId) {
    if (!voiceSessions.has(resolvedChannelId)) return;
    const session = voiceSessions.get(resolvedChannelId);
    if (!session.has(socket.id)) return;

    session.delete(socket.id);
    socketToChannel.delete(socket.id);
    const room = `voice-channel:${resolvedChannelId}`;
    socket.leave(room);

    // Notify other users
    socket.to(room).emit('voice:user_left', { socketId: socket.id, userId });

    logger.info(`[voice] user ${userId} left voice channel ${resolvedChannelId} (remaining: ${session.size})`);

    // Clean up empty room
    if (session.size === 0) {
      if (resolvedChannelId.startsWith('dm-voice:') && session.startTime && session.callerId && session.acceptorId) {
        const durationSec = Math.floor((Date.now() - session.startTime) / 1000);
        try {
          const DirectMessage = require('../models/DirectMessage');
          const minutes = Math.floor(durationSec / 60);
          const seconds = durationSec % 60;
          const durationStr = `${minutes > 0 ? minutes + ' phút ' : ''}${seconds} giây`;
          const receiverStr = String(userId) === session.callerId ? session.acceptorId : session.callerId;
          const msg = await DirectMessage.create({
            sender_id: String(userId),
            receiver_id: receiverStr,
            content: `📞 Cuộc gọi kết thúc (${durationStr})`,
            type: 'system'
          });
          io.to(`user:${session.callerId}`).emit('dm:message', msg);
          io.to(`user:${session.acceptorId}`).emit('dm:message', msg);
        } catch(e) { logger.error(e); }
      }
      voiceSessions.delete(resolvedChannelId);
    }
  }

  // ── Call Ringing Flow (Zalo-style) ──────────────────────────
  socket.on('voice:call_request', async ({ targetUserId }, ack) => {
    const callerInfo = {
      id: String(userId),
      name: user.name,
      avatar: user.avatar_url || '',
      realm: user.realm || 'Luyện Khí Kỳ'
    };
    socket.to(`user:${targetUserId}`).emit('voice:incoming_call', callerInfo);
    ack?.({ ok: true });
  });

  socket.on('voice:call_accept', ({ targetUserId }) => {
    const resolvedChannelId = resolveChannelId(`dm:${String(targetUserId)}`, String(userId));
    if (!voiceSessions.has(resolvedChannelId)) {
      const newSession = new Map();
      newSession.callerId = String(targetUserId);
      newSession.acceptorId = String(userId);
      voiceSessions.set(resolvedChannelId, newSession);
    } else {
      const session = voiceSessions.get(resolvedChannelId);
      session.callerId = String(targetUserId);
      session.acceptorId = String(userId);
    }

    socket.to(`user:${targetUserId}`).emit('voice:call_accepted', {
      id: String(userId),
      name: user.name,
      targetName: user.name,
      channelId: `dm:${String(userId)}`
    });
  });

  socket.on('voice:call_reject', async ({ targetUserId }) => {
    socket.to(`user:${targetUserId}`).emit('voice:call_rejected', {
      id: String(userId),
      name: user.name
    });
    try {
      const DirectMessage = require('../models/DirectMessage');
      const msg = await DirectMessage.create({
        sender_id: String(userId),
        receiver_id: String(targetUserId),
        content: 'Đã từ chối cuộc gọi',
        type: 'system'
      });
      io.to(`user:${targetUserId}`).emit('dm:message', msg);
      io.to(`user:${userId}`).emit('dm:message', msg);
    } catch(e){}
  });

  socket.on('voice:call_cancel', async ({ targetUserId }) => {
    socket.to(`user:${targetUserId}`).emit('voice:call_cancelled', {
      id: String(userId),
      name: user.name
    });
    try {
      const DirectMessage = require('../models/DirectMessage');
      const msg = await DirectMessage.create({
        sender_id: String(userId),
        receiver_id: String(targetUserId),
        content: 'Cuộc gọi nhỡ',
        type: 'text'
      });
      io.to(`user:${targetUserId}`).emit('dm:message', msg);
      io.to(`user:${userId}`).emit('dm:message', msg);
    } catch(e){}
  });

  // ── WebRTC Signaling Relays ────────────────────────────────
  socket.on('voice:offer', ({ targetSocketId, offer }) => {
    io.to(targetSocketId).emit('voice:offer', {
      senderSocketId: socket.id,
      offer,
    });
  });

  socket.on('voice:answer', ({ targetSocketId, answer }) => {
    io.to(targetSocketId).emit('voice:answer', {
      senderSocketId: socket.id,
      answer,
    });
  });

  socket.on('voice:ice_candidate', ({ targetSocketId, candidate }) => {
    io.to(targetSocketId).emit('voice:ice_candidate', {
      senderSocketId: socket.id,
      candidate,
    });
  });

  // ── Mic Status Changed ──────────────────────────────────────
  socket.on('voice:mic_status_changed', ({ channelId, enabled }) => {
    const resolvedChannelId = resolveChannelId(channelId, userId);
    if (!voiceSessions.has(resolvedChannelId)) return;
    const session = voiceSessions.get(resolvedChannelId);
    if (!session.has(socket.id)) return;

    session.get(socket.id).micEnabled = enabled;

    socket.to(`voice-channel:${resolvedChannelId}`).emit('voice:mic_status_changed', {
      socketId: socket.id,
      userId,
      enabled,
    });
    logger.info(`[voice] user ${userId} changed mic status to ${enabled}`);
  });

  // ── Speaking Status Changed ──────────────────────────────────
  socket.on('voice:speaking_status_changed', ({ channelId, isSpeaking }) => {
    const resolvedChannelId = resolveChannelId(channelId, userId);
    socket.to(`voice-channel:${resolvedChannelId}`).emit('voice:speaking_status_changed', {
      socketId: socket.id,
      userId,
      isSpeaking,
    });
  });

  // ── Clean up on socket disconnect ───────────────────────────
  socket.on('disconnect', async () => {
    if (socketToChannel.has(socket.id)) {
      const resolvedChannelId = socketToChannel.get(socket.id);
      await leaveVoiceChannel(resolvedChannelId);
    }
  });
};
