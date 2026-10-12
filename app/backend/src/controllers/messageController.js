/**
 * controllers/messageController.js – với Firebase Storage cho file/image messages
 */
const Message = require('../models/Message');
const Channel = require('../models/Channel');
const Sect    = require('../models/Sect');
const User    = require('../models/User');
const { uploadFile } = require('../utils/storage');

const messageController = {

  /** GET /api/channels/:id/messages */
  async index(req, res, next) {
    try {
      const { limit = 50, before } = req.query;
      const ch = await Channel.findById(req.params.id);
      if (!ch) return res.status(404).json({ error: 'Kênh không tồn tại' });

      const member = await Sect.isMember(ch.sect_id, req.user.id);
      if (!member) return res.status(403).json({ error: 'Bạn không phải thành viên tông môn này' });

      const messages = await Message.findByChannel(ch.id, +limit, before ? +before : null);
      res.json({ messages });
    } catch (e) { next(e); }
  },

  /** POST /api/channels/:id/messages (REST – supports text, file, image, voice) */
  async create(req, res, next) {
    try {
      const ch = await Channel.findById(req.params.id);
      if (!ch) return res.status(404).json({ error: 'Kênh không tồn tại' });

      const member = await Sect.isMember(ch.sect_id, req.user.id);
      if (!member) return res.status(403).json({ error: 'Không có quyền gửi tin nhắn' });

      let fileUrl = null, filePath = null, fileName = null;
      let msgType = 'text';
      let content = req.body.content || '';

      if (req.file) {
        const result = await uploadFile(req.file, 'chat/files');
        fileUrl  = result.url;
        filePath = result.path;
        fileName = req.file.originalname || 'file';
        if (req.body.type === 'voice')                   msgType = 'voice';
        else if (req.file.mimetype.startsWith('image/')) msgType = 'image';
        else if (req.file.mimetype.startsWith('audio/') || req.file.mimetype.startsWith('video/webm')) msgType = 'voice';
        else                                              msgType = 'file';
        if (!content) content = fileName;
      }

      if (!content.trim()) return res.status(422).json({ error: 'Nội dung không được trống' });

      const msg = await Message.create({
        channel_id: ch.id,
        user_id:    req.user.id,
        content,
        type:       msgType,
        file_url:   fileUrl,
        file_path:  filePath,
        file_name:  fileName,
      });

      // Broadcast to socket room so online members see the file instantly
      const io = req.app.get('io');
      if (io) io.to(`channel:${ch.id}`).emit('message:new', msg);

      await User.gainExp(req.user.id, 50);
      res.status(201).json({ message: msg });
    } catch (e) { next(e); }
  },

  /** POST /api/channels/messages/:id/react */
  async react(req, res, next) {
    try {
      const { emoji } = req.body;
      if (!emoji) return res.status(422).json({ error: 'emoji là bắt buộc' });
      const result = await Message.toggleReaction(req.params.id, req.user.id, emoji);
      res.json(result);
    } catch (e) { next(e); }
  },
};

module.exports = messageController;
