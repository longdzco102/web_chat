/**
 * controllers/blockController.js – Controller for managing blocked users
 */
const UserBlock = require('../models/UserBlock');
const User      = require('../models/User');

const blockController = {

  /** GET /api/blocks – Get list of blocked user IDs */
  async index(req, res, next) {
    try {
      const list = await UserBlock.getBlockedList(req.user.id);
      res.json({ blocked: list });
    } catch (e) {
      next(e);
    }
  },

  /** POST /api/blocks/:userId – Block a user */
  async blockUser(req, res, next) {
    try {
      const targetUserId = req.params.userId;
      
      const targetUser = await User.findById(targetUserId);
      if (!targetUser) {
        return res.status(404).json({ error: 'Đồng đạo này không tồn tại!' });
      }

      await UserBlock.block(req.user.id, targetUserId);
      
      res.json({ 
        ok: true, 
        message: `Đã giăng trận pháp bế quan với ${targetUser.name}, chặn đứng mọi truyền tin!` 
      });
    } catch (e) {
      next(e);
    }
  },

  /** DELETE /api/blocks/:userId – Unblock a user */
  async unblockUser(req, res, next) {
    try {
      const targetUserId = req.params.userId;

      await UserBlock.unblock(req.user.id, targetUserId);
      
      res.json({ 
        ok: true, 
        message: 'Đã thu hồi trận pháp, khôi phục luồng truyền tin!' 
      });
    } catch (e) {
      next(e);
    }
  }
};

module.exports = blockController;
