/**
 * models/Notification.js
 */
const db = require('../config/db');

const Notification = {
  async create({ user_id, title, content, type = 'system' }) {
    const [r] = await db.execute(
      'INSERT INTO notifications (user_id, title, content, type, is_read) VALUES (?, ?, ?, ?, 0)',
      [user_id, title, content, type]
    );
    return r.insertId;
  },

  async findByUser(userId) {
    const [rows] = await db.execute(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM notifications WHERE id = ? LIMIT 1',
      [id]
    );
    return rows[0] || null;
  },

  async findPendingFriendRequest(senderId, receiverId) {
    const [rows] = await db.execute(
      "SELECT * FROM notifications WHERE user_id = ? AND type = 'friend_request' AND is_read = 0",
      [receiverId]
    );
    for (const row of rows) {
      try {
        const data = JSON.parse(row.content);
        if (String(data.senderId) === String(senderId)) {
          return row;
        }
      } catch (e) {}
    }
    return null;
  },

  async findPendingSectInvite(sectId, userId) {
    const [rows] = await db.execute(
      "SELECT * FROM notifications WHERE user_id = ? AND type = 'sect_invite' AND is_read = 0",
      [userId]
    );
    for (const row of rows) {
      try {
        const data = JSON.parse(row.content);
        if (String(data.sectId) === String(sectId)) {
          return row;
        }
      } catch (e) {}
    }
    return null;
  },

  async updateNotification(id, { type, content, is_read = 1 }) {
    await db.execute(
      'UPDATE notifications SET type = ?, content = ?, is_read = ? WHERE id = ?',
      [type, content, is_read, id]
    );
  },

  async markAsRead(id, userId) {
    await db.execute(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId]
    );
  },

  async deleteAll(userId) {
    await db.execute(
      'DELETE FROM notifications WHERE user_id = ?',
      [userId]
    );
  }
};

module.exports = Notification;
