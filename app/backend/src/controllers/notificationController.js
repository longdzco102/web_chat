/**
 * controllers/notificationController.js
 */
const Notification = require('../models/Notification');

const notificationController = {
  async index(req, res, next) {
    try {
      const list = await Notification.findByUser(req.user.id);
      res.json({ notifications: list });
    } catch (e) {
      next(e);
    }
  },

  async markAsRead(req, res, next) {
    try {
      await Notification.markAsRead(req.params.id, req.user.id);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },

  async clearAll(req, res, next) {
    try {
      await Notification.deleteAll(req.user.id);
      res.json({ success: true });
    } catch (e) {
      next(e);
    }
  },

  async acceptInvite(req, res, next) {
    try {
      const notifId = req.params.id;
      const notif = await Notification.findById(notifId);
      if (!notif) {
        return res.status(404).json({ error: 'Không tìm thấy truyền tin này.' });
      }
      if (String(notif.user_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Đạo hữu không có quyền định đoạt truyền tin này.' });
      }
      if (notif.is_read && notif.type !== 'friend_request' && notif.type !== 'sect_invite') {
        return res.status(400).json({ error: 'Truyền tin này đã được xử lý từ trước.' });
      }

      const UserFriend = require('../models/UserFriend');
      const Sect = require('../models/Sect');
      const io = req.app.get('io');
      let message = '';

      if (notif.type === 'friend_request') {
        const data = JSON.parse(notif.content);
        const { senderId, senderName } = data;

        // Add friendship
        await UserFriend.addFriend(req.user.id, senderId);

        // Update current notification to accept state
        await Notification.updateNotification(notifId, {
          type: 'friend_accept',
          content: `Bạn và đạo hữu ${senderName} đã trở thành bằng hữu!`,
          is_read: 1
        });

        // Create success notification for the sender
        const senderNotifId = await Notification.create({
          user_id: senderId,
          title: '🤝 Kết Giao Thành Công',
          content: `Đạo hữu ${req.user.name} đã chấp nhận yêu cầu kết giao bằng hữu!`,
          type: 'friend_accept'
        });

        // Emit socket notification
        if (io) {
          io.to(`user:${senderId}`).emit('notification:new', {
            id: senderNotifId,
            title: '🤝 Kết Giao Thành Công',
            content: `Đạo hữu ${req.user.name} đã chấp nhận yêu cầu kết giao bằng hữu!`,
            type: 'friend_accept',
            is_read: 0,
            created_at: new Date()
          });
          io.to(`user:${req.user.id}`).emit('notification:new', {
            id: notifId,
            title: '🤝 Kết Giao Thành Công',
            content: `Bạn và đạo hữu ${senderName} đã trở thành bằng hữu!`,
            type: 'friend_accept',
            is_read: 1,
            created_at: new Date()
          });
          // Extra event to notify client to reload friend list
          io.to(`user:${senderId}`).emit('friend:update');
          io.to(`user:${req.user.id}`).emit('friend:update');
        }

        message = `Kết giao bằng hữu với đạo hữu ${senderName} thành công!`;

      } else if (notif.type === 'sect_invite') {
        const data = JSON.parse(notif.content);
        const { sectId, sectName, inviterId, inviterName } = data;

        // Add to sect members
        await Sect.addMember(sectId, req.user.id, 'de_tu');

        // Update current notification to accept state
        await Notification.updateNotification(notifId, {
          type: 'sect_invite_accept',
          content: `Bạn đã gia nhập Tông Môn "${sectName}"!`,
          is_read: 1
        });

        // Create success notification for the inviter
        const inviterNotifId = await Notification.create({
          user_id: inviterId,
          title: '📜 Chiêu Mộ Thành Công',
          content: `Đạo hữu ${req.user.name} đã gia nhập Tông Môn "${sectName}"!`,
          type: 'sect_invite_accept'
        });

        // Emit sockets
        if (io) {
          io.to(`user:${inviterId}`).emit('notification:new', {
            id: inviterNotifId,
            title: '📜 Chiêu Mộ Thành Công',
            content: `Đạo hữu ${req.user.name} đã gia nhập Tông Môn "${sectName}"!`,
            type: 'sect_invite_accept',
            is_read: 0,
            created_at: new Date()
          });
          io.to(`user:${req.user.id}`).emit('notification:new', {
            id: notifId,
            title: '📜 Gia Nhập Tông Môn',
            content: `Bạn đã gia nhập Tông Môn "${sectName}"!`,
            type: 'sect_invite_accept',
            is_read: 1,
            created_at: new Date()
          });
          // Extra event to notify client to reload sects list and members
          io.to(`user:${inviterId}`).emit('sect:update', { sectId });
          io.to(`user:${req.user.id}`).emit('sect:update', { sectId });
        }

        message = `Gia nhập Tông Môn "${sectName}" thành công!`;
      } else {
        return res.status(400).json({ error: 'Truyền tin này không hỗ trợ tương tác chấp nhận.' });
      }

      res.json({ success: true, message });
    } catch (e) {
      next(e);
    }
  },

  async rejectInvite(req, res, next) {
    try {
      const notifId = req.params.id;
      const notif = await Notification.findById(notifId);
      if (!notif) {
        return res.status(404).json({ error: 'Không tìm thấy truyền tin này.' });
      }
      if (String(notif.user_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Đạo hữu không có quyền định đoạt truyền tin này.' });
      }
      if (notif.is_read && notif.type !== 'friend_request' && notif.type !== 'sect_invite') {
        return res.status(400).json({ error: 'Truyền tin này đã được xử lý từ trước.' });
      }

      const io = req.app.get('io');
      let message = '';

      if (notif.type === 'friend_request') {
        const data = JSON.parse(notif.content);
        const { senderId, senderName } = data;

        // Update notification
        await Notification.updateNotification(notifId, {
          type: 'friend_reject',
          content: `Bạn đã từ chối yêu cầu kết giao bằng hữu của ${senderName}.`,
          is_read: 1
        });

        // Create reject notice for requester
        const senderNotifId = await Notification.create({
          user_id: senderId,
          title: '🤝 Cự Tuyệt Kết Giao',
          content: `Đạo hữu ${req.user.name} đã từ chối yêu cầu kết giao bằng hữu.`,
          type: 'friend_reject'
        });

        if (io) {
          io.to(`user:${senderId}`).emit('notification:new', {
            id: senderNotifId,
            title: '🤝 Cự Tuyệt Kết Giao',
            content: `Đạo hữu ${req.user.name} đã từ chối yêu cầu kết giao bằng hữu.`,
            type: 'friend_reject',
            is_read: 0,
            created_at: new Date()
          });
          io.to(`user:${req.user.id}`).emit('notification:new', {
            id: notifId,
            title: '🤝 Cự Tuyệt Kết Giao',
            content: `Bạn đã từ chối yêu cầu kết giao bằng hữu của ${senderName}.`,
            type: 'friend_reject',
            is_read: 1,
            created_at: new Date()
          });
        }

        message = `Đã từ chối kết giao bằng hữu với ${senderName}.`;

      } else if (notif.type === 'sect_invite') {
        const data = JSON.parse(notif.content);
        const { sectId, sectName, inviterId, inviterName } = data;

        // Update notification
        await Notification.updateNotification(notifId, {
          type: 'sect_invite_reject',
          content: `Bạn đã từ chối lời mời gia nhập Tông Môn "${sectName}".`,
          is_read: 1
        });

        // Create reject notice for inviter
        const inviterNotifId = await Notification.create({
          user_id: inviterId,
          title: '📜 Cự Tuyệt Chiêu Mộ',
          content: `Đạo hữu ${req.user.name} đã từ chối lời mời gia nhập Tông Môn "${sectName}".`,
          type: 'sect_invite_reject'
        });

        if (io) {
          io.to(`user:${inviterId}`).emit('notification:new', {
            id: inviterNotifId,
            title: '📜 Cự Tuyệt Chiêu Mộ',
            content: `Đạo hữu ${req.user.name} đã từ chối lời mời gia nhập Tông Môn "${sectName}".`,
            type: 'sect_invite_reject',
            is_read: 0,
            created_at: new Date()
          });
          io.to(`user:${req.user.id}`).emit('notification:new', {
            id: notifId,
            title: '📜 Cự Tuyệt Chiêu Mộ',
            content: `Bạn đã từ chối lời mời gia nhập Tông Môn "${sectName}".`,
            type: 'sect_invite_reject',
            is_read: 1,
            created_at: new Date()
          });
        }

        message = `Đã từ chối gia nhập Tông Môn "${sectName}".`;
      } else {
        return res.status(400).json({ error: 'Truyền tin này không hỗ trợ tương tác từ chối.' });
      }

      res.json({ success: true, message });
    } catch (e) {
      next(e);
    }
  }
};

module.exports = notificationController;
