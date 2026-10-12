/**
 * models/Post.js – TiDB version (cover_url, cover_path, destroy)
 */
const db = require('../config/db');

const Post = {

  async findAll({ tag = null, limit = 20, offset = 0 } = {}) {
    let sql = `
      SELECT p.*, u.name AS author_name, u.avatar_url AS author_avatar, u.realm AS author_realm,
             (SELECT COUNT(*) FROM post_comments c WHERE c.post_id=p.id) AS comment_count
      FROM posts p JOIN users u ON u.id=p.user_id`;
    const params = [];
    if (tag) { sql += ' WHERE p.tag=?'; params.push(tag); }
    sql += ` ORDER BY p.created_at DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`;
    const [rows] = await db.execute(sql, params);
    return rows;
  },

  async findById(id) {
    const [rows] = await db.execute(`
      SELECT p.*, u.name AS author_name, u.avatar_url AS author_avatar, u.realm AS author_realm,
             (SELECT COUNT(*) FROM post_comments c WHERE c.post_id=p.id) AS comment_count
      FROM posts p JOIN users u ON u.id=p.user_id WHERE p.id=? LIMIT 1`, [id]);
    return rows[0] ?? null;
  },

  async create({ user_id, title, content, excerpt, tag, icon, cover_url, cover_path }) {
    const [r] = await db.execute(
      'INSERT INTO posts (user_id,title,content,excerpt,tag,icon,cover_url,cover_path) VALUES (?,?,?,?,?,?,?,?)',
      [user_id, title, content, excerpt ?? content.slice(0,160), tag ?? 'tu-luyen', icon ?? '📖', cover_url, cover_path]
    );
    return r.insertId;
  },

  async destroy(id) {
    await db.execute('DELETE FROM posts WHERE id=?', [id]);
  },

  async incrementViews(id) {
    await db.execute('UPDATE posts SET views=views+1 WHERE id=?', [id]);
  },

  // ── Comments ──────────────────────────────────────
  async getComments(postId) {
    const [rows] = await db.execute(`
      SELECT c.*, u.name, u.avatar_url AS avatar, u.realm
      FROM post_comments c JOIN users u ON u.id=c.user_id
      WHERE c.post_id=? ORDER BY c.created_at ASC`, [postId]);
    return rows;
  },

  async addComment({ post_id, user_id, content }) {
    const [r] = await db.execute(
      'INSERT INTO post_comments (post_id,user_id,content) VALUES (?,?,?)',
      [post_id, user_id, content]
    );
    return r.insertId;
  },

  // ── Likes ─────────────────────────────────────────
  async toggleLike(postId, userId) {
    const [exists] = await db.execute(
      'SELECT 1 FROM post_likes WHERE post_id=? AND user_id=?', [postId, userId]
    );
    if (exists.length) {
      await db.execute('DELETE FROM post_likes WHERE post_id=? AND user_id=?', [postId, userId]);
      await db.execute('UPDATE posts SET likes=GREATEST(0,likes-1) WHERE id=?', [postId]);
      return { liked: false };
    }
    await db.execute('INSERT INTO post_likes (post_id,user_id) VALUES (?,?)', [postId, userId]);
    await db.execute('UPDATE posts SET likes=likes+1 WHERE id=?', [postId]);
    return { liked: true };
  },
};

module.exports = Post;
