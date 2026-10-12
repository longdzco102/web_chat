/**
 * controllers/friendController.js – Controller for managing friends
 */
const UserFriend = require('../models/UserFriend');
const User       = require('../models/User');

const friendController = {

  /** GET /api/friends – Get list of friends with their info */
  async index(req, res, next) {
    try {
      const list = await UserFriend.getFriendsList(req.user.id);
      // Clean up fields just in case
      const friends = list.map(f => {
        const { password, email, ...safe } = f;
        return safe;
      });
      res.json({ friends });
    } catch (e) {
      next(e);
    }
  },

  /** POST /api/friends/:userId – Add a friend (Send request) */
  async addFriend(req, res, next) {
    try {
      const targetUserId = req.params.userId;
      if (String(req.user.id) === String(targetUserId)) {
        return res.status(400).json({ error: 'Không thể tự kết bạn với chính mình trên con đường tu tiên!' });
      }
      
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Đồng đạo này không tồn tại!' });
      }

      // Check block status (optional, but a nice touch)
      const UserBlock = require('../models/UserBlock');
      const isBlocked = await UserBlock.isBlocked(targetUserId, req.user.id);
      if (isBlocked) {
        return res.status(403).json({ error: 'Không thể gửi yêu cầu kết bạn do đồng đạo đã bế quan từ chối tiếp chuyện.' });
      }

      // 1. Check if already friends
      const isAlreadyFriend = await UserFriend.isFriend(req.user.id, targetUserId);
      if (isAlreadyFriend) {
        return res.status(400).json({ error: 'Hai người đã là bằng hữu từ trước!' });
      }

      // 2. Check if pending friend request already exists
      const Notification = require('../models/Notification');
      const pendingRequest = await Notification.findPendingFriendRequest(req.user.id, targetUserId);
      if (pendingRequest) {
        return res.status(400).json({ error: 'Yêu cầu kết giao đang ở trạng thái chờ đối phương đồng ý.' });
      }

      // 3. Check if target user has sent a request to this user (reverse pending)
      const reversePending = await Notification.findPendingFriendRequest(targetUserId, req.user.id);
      if (reversePending) {
        // Automatically accept the request! They both wanted to add each other!
        await UserFriend.addFriend(req.user.id, targetUserId);
        
        // Update reverse request to accepted
        await Notification.updateNotification(reversePending.id, {
          type: 'friend_accept',
          content: `Đồng đạo ${targetUser.name} và bạn đã trở thành bằng hữu!`,
          is_read: 0
        });

        // Notify reverse sender (targetUser)
        const notifId = await Notification.create({
          user_id: targetUserId,
          title: '🤝 Kết Giao Thành Công',
          content: `Đạo hữu ${req.user.name} đã chấp nhận yêu cầu kết giao bằng hữu!`,
          type: 'friend_accept'
        });

        const io = req.app.get('io');
        if (io) {
          io.to(`user:${targetUserId}`).emit('notification:new', {
            id: notifId,
            title: '🤝 Kết Giao Thành Công',
            content: `Đạo hữu ${req.user.name} đã chấp nhận yêu cầu kết giao bằng hữu!`,
            type: 'friend_accept',
            is_read: 0,
            created_at: new Date()
          });
          io.to(`user:${req.user.id}`).emit('notification:new', {
            id: reversePending.id,
            title: '🤝 Kết Giao Thành Công',
            content: `Đồng đạo ${targetUser.name} và bạn đã trở thành bằng hữu!`,
            type: 'friend_accept',
            is_read: 0,
            created_at: new Date()
          });
        }

        return res.json({
          ok: true,
          message: `Nhân duyên trùng phùng! Hai người lập tức trở thành bằng hữu!`
        });
      }

      // Create notification for target user
      const notifId = await Notification.create({
        user_id: targetUserId,
        title: '🤝 Kết Giao Bằng Hữu',
        content: JSON.stringify({
          senderId: req.user.id,
          senderName: req.user.name,
          text: `Đạo hữu ${req.user.name} (${req.user.realm || 'Luyện Khí Kỳ'}) muốn kết giao bằng hữu với bạn!`
        }),
        type: 'friend_request'
      });

      // Create notification for sender
      const senderNotifId = await Notification.create({
        user_id: req.user.id,
        title: '🤝 Kết Giao Bằng Hữu',
        content: `Đã gửi yêu cầu kết giao bằng hữu tới đạo hữu ${targetUser.name}.`,
        type: 'friend_request_sent'
      });

      // Emit sockets
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${targetUserId}`).emit('notification:new', {
          id: notifId,
          title: '🤝 Kết Giao Bằng Hữu',
          content: `Đạo hữu ${req.user.name} (${req.user.realm || 'Luyện Khí Kỳ'}) muốn kết giao bằng hữu với bạn!`,
          type: 'friend_request',
          is_read: 0,
          created_at: new Date()
        });
        io.to(`user:${req.user.id}`).emit('notification:new', {
          id: senderNotifId,
          title: '🤝 Kết Giao Bằng Hữu',
          content: `Đã gửi yêu cầu kết giao bằng hữu tới đạo hữu ${targetUser.name}.`,
          type: 'friend_request_sent',
          is_read: 0,
          created_at: new Date()
        });
      }

      res.json({
        ok: true,
        message: `Đã phát truyền tin kết giao tới đạo hữu ${targetUser.name}!`
      });
    } catch (e) {
      next(e);
    }
  },

  /** DELETE /api/friends/:userId – Remove a friend */
  async removeFriend(req, res, next) {
    try {
      const targetUserId = req.params.userId;
      
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Đồng đạo này không tồn tại!' });
      }

      await UserFriend.removeFriend(req.user.id, targetUserId);
      
      res.json({ 
        ok: true, 
        message: `Đã cắt đứt nhân duyên kết bạn với ${targetUser.name}!` 
      });
    } catch (e) {
      next(e);
    }
  },

  /** GET /api/friends/:userId/check – Check friendship status */
  async checkFriend(req, res, next) {
    try {
      const targetUserId = req.params.userId;
      const isFriend = await UserFriend.isFriend(req.user.id, targetUserId);
      res.json({ isFriend });
    } catch (e) {
      next(e);
    }
  }
};

module.exports = friendController;
