/**
 * controllers/sectController.js
 * Group management: CRUD, join/leave, invite, kick, setRole.
 * Creator is automatically assigned 'tong_chu' role.
 */
const Sect    = require('../models/Sect');
const User    = require('../models/User');
const Channel = require('../models/Channel');

// Helper: assert caller is at least truong_lao
async function requireRole(sectId, userId, minRole = 'truong_lao') {
  const member = await Sect.getMember(sectId, userId);
  if (!member) throw Object.assign(new Error('Bạn không phải thành viên tông môn này'), { status: 403 });
  const rank = { tong_chu: 3, truong_lao: 2, de_tu: 1 };
  if ((rank[member.role] ?? 0) < rank[minRole]) {
    throw Object.assign(new Error('Không có quyền thực hiện hành động này'), { status: 403 });
  }
  return member;
}

const sectController = {

  /** GET /api/sects */
  async index(req, res, next) {
    try {
      const sects = await Sect.findAll();
      res.json({ sects });
    } catch (e) { next(e); }
  },

  /** GET /api/sects/mine – sects the current user belongs to */
  async mine(req, res, next) {
    try {
      const sects = await Sect.findByUser(req.user.id);
      res.json({ sects });
    } catch (e) { next(e); }
  },

  /** GET /api/sects/:id */
  async show(req, res, next) {
    try {
      const sect = await Sect.findById(req.params.id);
      if (!sect) return res.status(404).json({ error: 'Tông môn không tồn tại' });
      res.json({ sect });
    } catch (e) { next(e); }
  },

  /**
   * POST /api/sects
   * Creates sect + 6 default channels + assigns tong_chu role to creator.
   */
  async create(req, res, next) {
    try {
      const { name, icon = '🐉', description = '' } = req.body;
      const sectId = await Sect.create({ name, icon, description, owner_id: req.user.id });

      // Auto-create default channels
      const defaultChannels = [
        { name: 'thông-báo',         type: 'announcement', icon: '📢', position: 0 },
        { name: 'đại-sảnh',          type: 'text',         icon: '#',  position: 1 },
        { name: 'tu-luyện-tâm-đắc', type: 'text',         icon: '#',  position: 2 },
        { name: 'chiến-đấu-thử-tài',type: 'text',         icon: '⚔', position: 3 },
        { name: 'bảo-vật-giao-dịch',type: 'text',         icon: '💎', position: 4 },
        { name: 'đại-điện-hội-nghị',type: 'voice',        icon: '🔊', position: 5 },
      ];
      for (const ch of defaultChannels) {
        await Channel.create({ sect_id: sectId, ...ch });
      }

      // Creator = tong_chu
      await Sect.addMember(sectId, req.user.id, 'tong_chu');

      const sect = await Sect.findById(sectId);
      res.status(201).json({ sect });
    } catch (e) { next(e); }
  },

  /** PATCH /api/sects/:id */
  async update(req, res, next) {
    try {
      await requireRole(req.params.id, req.user.id, 'tong_chu');
      const { name, icon, description } = req.body;
      await Sect.update(req.params.id, { name, icon, description });
      const sect = await Sect.findById(req.params.id);
      res.json({ sect });
    } catch (e) { next(e); }
  },

  /** DELETE /api/sects/:id */
  async destroy(req, res, next) {
    try {
      await requireRole(req.params.id, req.user.id, 'tong_chu');
      await Sect.destroy(req.params.id);
      res.json({ message: 'Đã giải tán Tông Môn' });
    } catch (e) { next(e); }
  },

  /** POST /api/sects/:id/join */
  async join(req, res, next) {
    try {
      const sect = await Sect.findById(req.params.id);
      if (!sect) return res.status(404).json({ error: 'Tông môn không tồn tại' });
      const existing = await Sect.getMember(req.params.id, req.user.id);
      if (existing) return res.status(409).json({ error: 'Bạn đã là thành viên rồi' });
      await Sect.addMember(req.params.id, req.user.id, 'de_tu');
      res.json({ message: 'Đã gia nhập Tông Môn!' });
    } catch (e) { next(e); }
  },

  /** DELETE /api/sects/:id/leave */
  async leave(req, res, next) {
    try {
      const member = await Sect.getMember(req.params.id, req.user.id);
      if (!member) return res.status(404).json({ error: 'Bạn không phải thành viên' });
      if (member.role === 'tong_chu') {
        return res.status(400).json({ error: 'Tông Chủ không thể rời tông. Hãy giải tán hoặc nhượng chức trước.' });
      }
      await Sect.removeMember(req.params.id, req.user.id);
      res.json({ message: 'Đã rời Tông Môn' });
    } catch (e) { next(e); }
  },

  /** GET /api/sects/:id/members */
  async members(req, res, next) {
    try {
      const members = await Sect.getMembers(req.params.id);
      res.json({ members });
    } catch (e) { next(e); }
  },

  /** GET /api/sects/:id/channels */
  async channels(req, res, next) {
    try {
      const channels = await Channel.findBySect(req.params.id);
      res.json({ channels });
    } catch (e) { next(e); }
  },

  /**
   * POST /api/sects/:id/invite
   * Invite by email → add as de_tu if user exists.
   */
  async invite(req, res, next) {
    try {
      await requireRole(req.params.id, req.user.id, 'truong_lao');
      const { name } = req.body;
      const target = await User.findByName(name);
      if (!target) return res.status(404).json({ error: `Không tìm thấy người dùng có tên: ${name}` });

      const existing = await Sect.getMember(req.params.id, target.id);
      if (existing) return res.status(409).json({ error: 'Người này đã là thành viên rồi' });

      const sect = await Sect.findById(req.params.id);
      if (!sect) return res.status(404).json({ error: 'Tông Môn không tồn tại!' });

      // 1. Check if pending sect invite already exists
      const Notification = require('../models/Notification');
      const pendingInvite = await Notification.findPendingSectInvite(req.params.id, target.id);
      if (pendingInvite) {
        return res.status(400).json({ error: 'Lời mời tham gia Tông Môn đã được gửi trước đó và đang chờ phản hồi.' });
      }

      // 2. Create interactive notification for target
      const notifId = await Notification.create({
        user_id: target.id,
        title: '📜 Chiêu Mộ Tông Môn',
        content: JSON.stringify({
          sectId: req.params.id,
          sectName: sect.name,
          inviterId: req.user.id,
          inviterName: req.user.name,
          text: `Đạo hữu đã được Trưởng Lão "${req.user.name}" chiêu mộ vào Tông Môn "${sect.name}" với tư cách Đệ Tử! 🎉`
        }),
        type: 'sect_invite'
      });

      // 3. Create notification for inviter/sender
      const senderNotifId = await Notification.create({
        user_id: req.user.id,
        title: '📜 Chiêu Mộ Tông Môn',
        content: `Đã gửi lời mời chiêu mộ đệ tử tới đạo hữu ${target.name}.`,
        type: 'sect_invite_sent'
      });

      // 4. Emit sockets
      const io = req.app.get('io');
      if (io) {
        io.to(`user:${target.id}`).emit('notification:new', {
          id: notifId,
          title: '📜 Chiêu Mộ Tông Môn',
          content: `Đạo hữu đã được Trưởng Lão "${req.user.name}" chiêu mộ vào Tông Môn "${sect.name}" với tư cách Đệ Tử! 🎉`,
          type: 'sect_invite',
          is_read: 0,
          created_at: new Date()
        });
        io.to(`user:${req.user.id}`).emit('notification:new', {
          id: senderNotifId,
          title: '📜 Chiêu Mộ Tông Môn',
          content: `Đã gửi lời mời chiêu mộ đệ tử tới đạo hữu ${target.name}.`,
          type: 'sect_invite_sent',
          is_read: 0,
          created_at: new Date()
        });
      }

      res.json({ message: `Đã phát truyền tin chiêu mộ ${target.name} gia nhập Tông Môn!` });
    } catch (e) { next(e); }
  },

  /**
   * DELETE /api/sects/:id/kick/:userId
   * Remove a member (tong_chu can kick anyone, truong_lao can kick de_tu only).
   */
  async kick(req, res, next) {
    try {
      const caller = await requireRole(req.params.id, req.user.id, 'truong_lao');
      const target = await Sect.getMember(req.params.id, req.params.userId);
      if (!target) return res.status(404).json({ error: 'Thành viên không tồn tại' });
      if (target.role === 'tong_chu') return res.status(403).json({ error: 'Không thể kick Tông Chủ' });
      if (caller.role === 'truong_lao' && target.role === 'truong_lao') {
        return res.status(403).json({ error: 'Trưởng Lão không thể kick Trưởng Lão' });
      }
      await Sect.removeMember(req.params.id, req.params.userId);
      res.json({ message: 'Đã xóa thành viên khỏi Tông Môn' });
    } catch (e) { next(e); }
  },

  /**
   * PATCH /api/sects/:id/members/:userId/role
   * Change member role (tong_chu only).
   */
  async setRole(req, res, next) {
    try {
      await requireRole(req.params.id, req.user.id, 'tong_chu');
      const { role } = req.body;
      const validRoles = ['truong_lao', 'de_tu'];
      if (!validRoles.includes(role)) {
        return res.status(422).json({ error: `Role phải là: ${validRoles.join(', ')}` });
      }
      const target = await Sect.getMember(req.params.id, req.params.userId);
      if (!target) return res.status(404).json({ error: 'Thành viên không tồn tại' });
      if (target.role === 'tong_chu') return res.status(403).json({ error: 'Không thể đổi role Tông Chủ' });
      await Sect.setMemberRole(req.params.id, req.params.userId, role);
      res.json({ message: 'Đã cập nhật chức vụ' });
    } catch (e) { next(e); }
  },
  // ── Channel Management ────────────────────────────────────────────────────────────────────

  /** POST /api/sects/:id/channels */
  async createChannel(req, res, next) {
    try {
      await requireRole(req.params.id, req.user.id, 'truong_lao');
      const { name, type = 'text', icon } = req.body;
      if (!name) return res.status(422).json({ error: 'Tên kênh không được trống' });
      const validTypes = ['text', 'voice', 'announcement'];
      const chType = validTypes.includes(type) ? type : 'text';
      const chIcon = icon || (chType === 'voice' ? '🔊' : chType === 'announcement' ? '📢' : '#');
      const id = await Channel.create({ sect_id: req.params.id, name, type: chType, icon: chIcon, position: 99 });
      const channels = await Channel.findBySect(req.params.id);
      res.status(201).json({ channel: channels.find(c => String(c.id) === String(id)), channels });
    } catch (e) { next(e); }
  },

  /** PATCH /api/sects/:id/channels/:channelId */
  async updateChannel(req, res, next) {
    try {
      await requireRole(req.params.id, req.user.id, 'truong_lao');
      const { name, icon } = req.body;
      if (!name) return res.status(422).json({ error: 'Tên kênh không được trống' });
      const db = require('../config/db');
      await db.execute('UPDATE channels SET name=?, icon=? WHERE id=? AND sect_id=?',
        [name, icon || '#', req.params.channelId, req.params.id]);
      const channels = await Channel.findBySect(req.params.id);
      res.json({ channels });
    } catch (e) { next(e); }
  },

  /** DELETE /api/sects/:id/channels/:channelId */
  async deleteChannel(req, res, next) {
    try {
      await requireRole(req.params.id, req.user.id, 'truong_lao');
      const db = require('../config/db');
      await db.execute('DELETE FROM messages WHERE channel_id=?', [req.params.channelId]);
      await db.execute('DELETE FROM channels WHERE id=? AND sect_id=?',
        [req.params.channelId, req.params.id]);
      res.json({ message: 'Đã xóa kênh' });
    } catch (e) { next(e); }
  },
};

module.exports = sectController;
