/**
 * models/UserFriend.js – DB queries for friendship
 */
const db = require('../config/db');

const UserFriend = {
  /** Add a friend (mutual relationship) */
  async addFriend(userId, friendId) {
    if (String(userId) === String(friendId)) {
      throw new Error('Không thể tự kết bạn với chính mình trên con đường tu tiên!');
    }
    
    // Check if already friends
    const [ex] = await db.execute(
      'SELECT 1 FROM user_friends WHERE user_id=? AND friend_id=?',
      [userId, friendId]
    );
    if (ex.length > 0) return true;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      
      // A -> B
      await conn.execute(
        'INSERT IGNORE INTO user_friends (user_id, friend_id) VALUES (?, ?)',
        [userId, friendId]
      );
      
      // B -> A (Mutual friendship)
      await conn.execute(
        'INSERT IGNORE INTO user_friends (user_id, friend_id) VALUES (?, ?)',
        [friendId, userId]
      );
      
      await conn.commit();
      return true;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  /** Remove a friend (mutual relationship deletion) */
  async removeFriend(userId, friendId) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      
      await conn.execute(
        'DELETE FROM user_friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)',
        [userId, friendId, friendId, userId]
      );
      
      await conn.commit();
      return true;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },

  /** Check if they are friends */
  async isFriend(userId, friendId) {
    if (!userId || !friendId) return false;
    const [rows] = await db.execute(
      'SELECT 1 FROM user_friends WHERE user_id=? AND friend_id=? LIMIT 1',
      [userId, friendId]
    );
    return rows.length > 0;
  },

  /** Get list of friends (with details) */
  async getFriendsList(userId) {
    const [rows] = await db.execute(
      `SELECT u.id, u.name, u.avatar_url AS avatar, u.role, u.realm, u.exp, u.status 
       FROM user_friends uf
       JOIN users u ON uf.friend_id = u.id
       WHERE uf.user_id = ?`,
      [userId]
    );
    return rows;
  }
};

module.exports = UserFriend;
