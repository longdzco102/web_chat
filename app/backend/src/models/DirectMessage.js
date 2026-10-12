/**
 * models/DirectMessage.js – DB queries for direct messages
 */
const db = require('../config/db');
const { getRealmByIndex } = require('../config/realmSystem');

const DirectMessage = {

  /** Get DM history between two users (oldest-first) */
  async findByUsers(userId1, userId2, limit = 50, before = null) {
    let sql = `
      SELECT m.*,
             u.name, u.avatar_url AS avatar, u.realm, u.realm_index
      FROM direct_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))`;
    const params = [userId1, userId2, userId2, userId1];
    
    if (before) {
      sql += ' AND m.id < ?';
      params.push(before);
    }
    
    sql += ` ORDER BY m.created_at DESC LIMIT ${Number(limit)}`;

    const [rows] = await db.execute(sql, params);
    
    return rows.reverse().map(row => ({
      ...row,
      realm_css: getRealmByIndex(row.realm_index ?? 0).css,
    }));
  },

  /** Insert a direct message, return full row with sender info */
  async create({ sender_id, receiver_id, content, type = 'text', file_url = null, file_path = null, file_name = null }) {
    const [r] = await db.execute(
      'INSERT INTO direct_messages (sender_id, receiver_id, content, type, file_url, file_path, file_name, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [String(sender_id), String(receiver_id), content, type, file_url, file_path, file_name, new Date()]
    );

    const [rows] = await db.execute(`
      SELECT m.*, u.name, u.avatar_url AS avatar, u.realm, u.realm_index
      FROM direct_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.id = ?`,
      [r.insertId]
    );

    const row = rows[0];
    return {
      ...row,
      realm_css: getRealmByIndex(row?.realm_index ?? 0).css,
    };
  },

  /** Mark all unread messages from a sender to a receiver as read */
  async markAsRead(senderId, receiverId) {
    await db.execute(
      'UPDATE direct_messages SET is_read = 1 WHERE sender_id = ? AND receiver_id = ? AND is_read = 0',
      [senderId, receiverId]
    );
    return true;
  },

  /** 
   * Get list of recent conversations for a user.
   * Returns list of unique users with their last message and unread count.
   */
  async getRecentConversations(userId) {
    // 1. Get contact_id of recent chats
    const [contacts] = await db.execute(`
      SELECT DISTINCT
        CASE WHEN sender_id = ? THEN receiver_id ELSE sender_id END AS contact_id
      FROM direct_messages
      WHERE sender_id = ? OR receiver_id = ?
    `, [userId, userId, userId]);

    if (contacts.length === 0) return [];

    const conversations = [];
    for (const c of contacts) {
      const contactId = c.contact_id;
      
      // 2. Fetch user information
      const [uRows] = await db.execute(
        `SELECT id, name, avatar_url AS avatar, realm, realm_index, status FROM users WHERE id = ? LIMIT 1`,
        [contactId]
      );
      if (uRows.length === 0) continue;
      const u = uRows[0];

      // 3. Fetch latest message
      const [msgRows] = await db.execute(`
        SELECT content, type, created_at, sender_id
        FROM direct_messages
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at DESC LIMIT 1
      `, [userId, contactId, contactId, userId]);

      if (msgRows.length === 0) continue;
      const dm = msgRows[0];

      // 4. Count unread messages
      const [unreadRows] = await db.execute(`
        SELECT COUNT(*) AS count FROM direct_messages
        WHERE sender_id = ? AND receiver_id = ? AND is_read = 0
      `, [contactId, userId]);
      const unreadCount = unreadRows[0]?.count ?? 0;

      conversations.push({
        id: u.id,
        name: u.name,
        avatar: u.avatar,
        realm: u.realm,
        realm_index: u.realm_index,
        realm_css: getRealmByIndex(u.realm_index ?? 0).css,
        status: u.status || 'offline',
        last_message_content: dm.content,
        last_message_type: dm.type,
        last_message_time: dm.created_at,
        last_message_sender_id: dm.sender_id,
        unread_count: unreadCount
      });
    }

    // Sort by latest message time descending
    conversations.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));
    return conversations;
  }
};

module.exports = DirectMessage;
