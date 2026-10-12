/**
 * controllers/authController.js – với avatar upload lên Firebase
 */
const User      = require('../models/User');
const jwtHelper = require('../config/jwt');
const { uploadFile, deleteFile } = require('../utils/storage');

const authController = {

  /** POST /api/auth/register */
  async register(req, res, next) {
    try {
      const { name, email, password } = req.body;
      const existing = await User.findByEmail(email);
      if (existing) return res.status(409).json({ error: 'Email đã được đăng ký' });

      let avatarUrl = null, avatarPath = null;
      if (req.file) {
        const result = await uploadFile(req.file, 'avatars');
        avatarUrl  = result.url;
        avatarPath = result.path;
      }

      const id   = await User.create({ name, email, password, avatarUrl, avatarPath });
      const user = await User.findById(id);
      const token = jwtHelper.sign({ id: user.id, email: user.email });
      res.status(201).json({ token, user });
    } catch (e) { next(e); }
  },

  /** POST /api/auth/login */
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const user = await User.findByEmail(email);
      if (!user) return res.status(401).json({ error: 'Email hoặc mật khẩu sai' });

      const ok = await User.checkPassword(password, user.password);
      if (!ok) return res.status(401).json({ error: 'Email hoặc mật khẩu sai' });

      await User.setStatus(user.id, 'online');
      const token = jwtHelper.sign({ id: user.id, email: user.email });
      res.json({ token, user: User.toPublic(user) });
    } catch (e) { next(e); }
  },

  /** GET /api/auth/me */
  async me(req, res) {
    res.json({ user: req.user });
  },

  /** POST /api/auth/logout */
  async logout(req, res, next) {
    try {
      await User.setStatus(req.user.id, 'offline');
      res.json({ message: 'Đã đăng xuất' });
    } catch (e) { next(e); }
  },

  /** PATCH /api/auth/avatar */
  async updateAvatar(req, res, next) {
    try {
      if (!req.file) return res.status(422).json({ error: 'Vui lòng chọn ảnh' });
      // Xoá avatar cũ
      const old = await User.findById(req.user.id);
      if (old?.avatar_path) await deleteFile(old.avatar_path).catch(() => {});
      // Upload avatar mới
      const { url, path: fPath } = await uploadFile(req.file, 'avatars');
      await User.updateAvatar(req.user.id, url, fPath);
      res.json({ avatar_url: url });
    } catch (e) { next(e); }
  },

  /** PATCH /api/auth/settings */
  async updateSettings(req, res, next) {
    try {
      const updates = { gender: req.body.gender };
      if (req.file) {
        const old = await User.findById(req.user.id);
        if (old?.avatar_path) await deleteFile(old.avatar_path).catch(() => {});
        const { url, path: fPath } = await uploadFile(req.file, 'avatars');
        updates.avatarUrl = url;
        updates.avatarPath = fPath;
      }
      await User.updateSettings(req.user.id, updates);
      
      const updatedUser = await User.findById(req.user.id);
      res.json({ user: User.toPublic(updatedUser) });
    } catch (e) { next(e); }
  },

  /** GET /api/auth/users/search */
  async searchUsers(req, res, next) {
    try {
      const q = req.query.q || '';
      if (!q.trim()) return res.json({ users: [] });
      const users = await User.search(q);
      res.json({ users });
    } catch (e) { next(e); }
  },

  /** GET /api/auth/users/:id */
  async getUser(req, res, next) {
    try {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ error: 'Đồng đạo này không tồn tại!' });
      
      const publicUser = User.toPublic(user);
      // Nếu không phải là chính chủ đang truy vấn, ẩn email đi để bảo mật
      if (String(req.user.id) !== String(user.id)) {
        delete publicUser.email;
      }
      
      res.json({ user: publicUser });
    } catch (e) { next(e); }
  },
};

module.exports = authController;
