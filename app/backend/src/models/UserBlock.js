/**
 * models/UserBlock.js – DB queries for blocking users
 */
const db = require('../config/db');

const UserBlock = {

  /** Block a user */
  async block(userId, blockedUserId) {
    if (String(userId) === String(blockedUserId)) {
      throw new Error('Không thể tự chặn bản thân trên con đường tu tiên!');
    }
    // Check if already blocked
    const [ex] = await db.execute(
      'SELECT 1 FROM user_blocks WHERE user_id=? AND blocked_user_id=?',
      [userId, blockedUserId]
    );
    if (ex.length > 0) return true;

    await db.execute(
      'INSERT INTO user_blocks (user_id, blocked_user_id) VALUES (?, ?)',
      [userId, blockedUserId]
    );
    return true;
  },

  /** Unblock a user */
  async unblock(userId, blockedUserId) {
    await db.execute(
      'DELETE FROM user_blocks WHERE user_id=? AND blocked_user_id=?',
      [userId, blockedUserId]
    );
    return true;
  },

  /** 
   * Check if either user has blocked the other.
   * Returns true if userId has blocked targetId OR targetId has blocked userId.
   */
  async isBlocked(userId, targetId) {
    if (!userId || !targetId) return false;
    const [rows] = await db.execute(
      'SELECT 1 FROM user_blocks WHERE (user_id=? AND blocked_user_id=?) OR (user_id=? AND blocked_user_id=?) LIMIT 1',
      [userId, targetId, targetId, userId]
    );
    return rows.length > 0;
  },

  /** Get list of user IDs that userId has blocked */
  async getBlockedList(userId) {
    const [rows] = await db.execute(
      'SELECT blocked_user_id FROM user_blocks WHERE user_id=?',
      [userId]
    );
    return rows.map(r => r.blocked_user_id);
  }
};

module.exports = UserBlock;
