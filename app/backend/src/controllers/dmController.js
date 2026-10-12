/**
 * controllers/dmController.js – Controller for Direct Messaging (DMs)
 */
const DirectMessage = require('../models/DirectMessage');
const UserBlock     = require('../models/UserBlock');
const User          = require('../models/User');
const { uploadFile } = require('../utils/storage');

const dmController = {

  /** GET /api/dms – Get all recent DM conversations */
  async getConversations(req, res, next) {
    try {
      const conversations = await DirectMessage.getRecentConversations(req.user.id);
      res.json({ conversations });
    } catch (e) {
      next(e);
    }
  },

  /** GET /api/dms/:userId – Get chat history between me and target cultivator */
  async index(req, res, next) {
    try {
      const { limit = 50, before } = req.query;
      const targetUserId = req.params.userId;
      
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Đồng đạo này không tồn tại trên cõi đời!' });
      }

      // Mark messages from target to me as read
      await DirectMessage.markAsRead(targetUserId, req.user.id);

      const messages = await DirectMessage.findByUsers(req.user.id, targetUserId, +limit, before ? +before : null);
      
      res.json({ messages });
    } catch (e) {
      next(e);
    }
  },

  /** POST /api/dms/:userId – Send private message */
  async create(req, res, next) {
    try {
      const targetUserId = req.params.userId;

      // 1. Check target user existence
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Đồng đạo này không tồn tại trên cõi đời!' });
      }

      // 2. Check if either user is blocked
      const isBlocked = await UserBlock.isBlocked(req.user.id, targetUserId);
      if (isBlocked) {
        return res.status(403).json({ error: 'Trận pháp bế quan đang kích hoạt. Không thể truyền tin hoặc giao tiếp!' });
      }

      let fileUrl = null, filePath = null, fileName = null;
      let msgType = 'text';
      let content = req.body.content || '';

      // 3. Handle file upload (images, voice, general files)
      if (req.file) {
        const result = await uploadFile(req.file, 'chat/dms');
        fileUrl  = result.url;
        filePath = result.path;
        fileName = req.file.originalname || 'file';
        
        if (req.body.type === 'voice') {
          msgType = 'voice';
        } else if (req.file.mimetype.startsWith('image/')) {
          msgType = 'image';
        } else if (req.file.mimetype.startsWith('audio/') || req.file.mimetype.startsWith('video/webm')) {
          msgType = 'voice';
        } else {
          msgType = 'file';
        }
        
        if (!content) content = fileName;
      }

      if (!content.trim()) {
        return res.status(422).json({ error: 'Nội dung tin nhắn không thể để trống' });
      }

      // 4. Save to database
      const msg = await DirectMessage.create({
        sender_id:   req.user.id,
        receiver_id: targetUserId,
        content,
        type:        msgType,
        file_url:    fileUrl,
        file_path:   filePath,
        file_name:   fileName,
      });

      // 5. Broadcast to Socket rooms for both sender and receiver
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${req.user.id}`).emit('dm:message', msg);
        io.to(`user:${targetUserId}`).emit('dm:message', msg);
      }

      // 6. Gain minor EXP for communicating (20 exp instead of 50 for group chats to avoid spam)
      await User.gainExp(req.user.id, 20);

      res.status(201).json({ message: msg });
    } catch (e) {
      next(e);
    }
  },

  /** PATCH /api/dms/:userId/read – Mark all DMs from target user as read */
  async markRead(req, res, next) {
    try {
      const targetUserId = req.params.userId;
      await DirectMessage.markAsRead(targetUserId, req.user.id);
      res.json({ message: 'Đã đánh dấu đọc' });
    } catch (e) {
      next(e);
    }
  }
};

module.exports = dmController;
