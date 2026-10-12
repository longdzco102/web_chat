/**
 * controllers/postController.js – với Firebase Storage cho cover image
 */
const Post    = require('../models/Post');
const User    = require('../models/User');
const { uploadFile, deleteFile } = require('../utils/storage');

const postController = {

  /** GET /api/posts */
  async index(req, res, next) {
    try {
      const { tag, limit = 20, offset = 0 } = req.query;
      const posts = await Post.findAll({ tag, limit: +limit, offset: +offset });
      res.json({ posts });
    } catch (e) { next(e); }
  },

  /** GET /api/posts/:id */
  async show(req, res, next) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Bài viết không tồn tại' });
      await Post.incrementViews(post.id);
      const comments = await Post.getComments(post.id);
      res.json({ post: { ...post, views: post.views + 1 }, comments });
    } catch (e) { next(e); }
  },

  /** POST /api/posts  (multipart/form-data nếu có cover image) */
  async create(req, res, next) {
    try {
      const { title, content, tag, icon } = req.body;
      let coverUrl = null, coverPath = null;

      // Upload ảnh bìa lên Firebase nếu có
      if (req.file) {
        const result = await uploadFile(req.file, 'posts/covers');
        coverUrl  = result.url;
        coverPath = result.path;
      }

      const excerpt = content.slice(0, 160);
      const id = await Post.create({
        user_id: req.user.id, title, content, excerpt,
        tag, icon, cover_url: coverUrl, cover_path: coverPath,
      });
      const post = await Post.findById(id);
      await User.gainExp(req.user.id, 500);
      res.status(201).json({ post });
    } catch (e) {
      // Nếu upload xong nhưng DB lỗi, xoá file tránh orphan
      if (e._coverPath) await deleteFile(e._coverPath).catch(() => {});
      next(e);
    }
  },

  /** DELETE /api/posts/:id */
  async destroy(req, res, next) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Bài viết không tồn tại' });
      if (post.user_id !== req.user.id && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Không có quyền xoá bài viết này' });
      }
      // Xoá cover khỏi Firebase
      if (post.cover_path) await deleteFile(post.cover_path);
      await Post.destroy(post.id);
      res.json({ message: 'Đã xoá bài viết' });
    } catch (e) { next(e); }
  },

  /** POST /api/posts/:id/like */
  async toggleLike(req, res, next) {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) return res.status(404).json({ error: 'Bài viết không tồn tại' });
      const result = await Post.toggleLike(post.id, req.user.id);
      if (result.liked) await User.gainExp(req.user.id, 50);
      res.json(result);
    } catch (e) { next(e); }
  },

  /** GET /api/posts/:id/comments */
  async getComments(req, res, next) {
    try {
      const comments = await Post.getComments(req.params.id);
      res.json({ comments });
    } catch (e) { next(e); }
  },

  /** POST /api/posts/:id/comments */
  async addComment(req, res, next) {
    try {
      const { content } = req.body;
      const id = await Post.addComment({ post_id: req.params.id, user_id: req.user.id, content });
      await User.gainExp(req.user.id, 100);
      res.status(201).json({ id, message: 'Đã gửi bình luận' });
    } catch (e) { next(e); }
  },
};

module.exports = postController;
