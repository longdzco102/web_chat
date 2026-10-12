/**
 * models/Message.js – DB queries for messages + reactions
 * Returns realm_css and sect_role so ChatView can color names properly.
 */
const db = require('../config/db');
const { getRealmByIndex } = require('../config/realmSystem');

const Message = {

  /** Get latest N messages for a channel (oldest-first for display) */
  async findByChannel(channelId, limit = 50, before = null) {
    let sql = `
      SELECT m.*,
             u.name, u.avatar_url AS avatar, u.realm, u.realm_index,
             sm.role AS sect_role,
             JSON_ARRAYAGG(
               JSON_OBJECT('emoji', r.emoji, 'user_id', r.user_id)
             ) AS raw_reactions
      FROM messages m
      JOIN users u ON u.id = m.user_id
      JOIN channels ch ON ch.id = m.channel_id
      LEFT JOIN sect_members sm ON sm.sect_id = ch.sect_id AND sm.user_id = m.user_id
      LEFT JOIN message_reactions r ON r.message_id = m.id
      WHERE m.channel_id = ?`;
    const params = [channelId];
    if (before) { sql += ' AND m.id < ?'; params.push(before); }
    sql += ` GROUP BY m.id, u.name, u.avatar_url, u.realm, u.realm_index, sm.role ORDER BY m.created_at DESC LIMIT ${Number(limit)}`;

    const [rows] = await db.execute(sql, params);
    return rows.reverse().map(row => ({
      ...row,
      realm_css:     getRealmByIndex(row.realm_index ?? 0).css,
      reactions:     Message._groupReactions(
        typeof row.raw_reactions === 'string' ? JSON.parse(row.raw_reactions || '[]') : (row.raw_reactions || [])
      ),
      raw_reactions: undefined,
    }));
  },

  /** Insert a message, return full row with user info + realm_css + sect_role */
  async create({ channel_id, user_id, content, type = 'text', file_url = null, file_path = null, file_name = null }) {
    const [r] = await db.execute(
      'INSERT INTO messages (channel_id,user_id,content,type,file_url,file_path,file_name,created_at) VALUES (?,?,?,?,?,?,?,?)',
      [channel_id, user_id, content, type, file_url, file_path, file_name, new Date()]
    );

    const [rows] = await db.execute(`
      SELECT m.*, u.name, u.avatar_url AS avatar, u.realm, u.realm_index,
             sm.role AS sect_role
      FROM messages m
      JOIN users u ON u.id = m.user_id
      JOIN channels ch ON ch.id = m.channel_id
      LEFT JOIN sect_members sm ON sm.sect_id = ch.sect_id AND sm.user_id = m.user_id
      WHERE m.id = ?`,
      [r.insertId]
    );

    const row = rows[0];
    return {
      ...row,
      realm_css: getRealmByIndex(row?.realm_index ?? 0).css,
      reactions: [],
    };
  },

  /** Toggle emoji reaction; returns { emoji, count, reacted } */
  async toggleReaction(messageId, userId, emoji) {
    const [ex] = await db.execute(
      'SELECT 1 FROM message_reactions WHERE message_id=? AND user_id=? AND emoji=?',
      [messageId, userId, emoji]
    );
    if (ex.length) {
      await db.execute(
        'DELETE FROM message_reactions WHERE message_id=? AND user_id=? AND emoji=?',
        [messageId, userId, emoji]
      );
    } else {
      await db.execute(
        'INSERT INTO message_reactions (message_id,user_id,emoji) VALUES (?,?,?)',
        [messageId, userId, emoji]
      );
    }
    const [cnt] = await db.execute(
      'SELECT COUNT(*) AS n FROM message_reactions WHERE message_id=? AND emoji=?',
      [messageId, emoji]
    );
    return { emoji, count: cnt[0].n, reacted: !ex.length };
  },

  _groupReactions(raw) {
    const map = {};
    raw.forEach(({ emoji, user_id }) => {
      if (!emoji) return;
      if (!map[emoji]) map[emoji] = { emoji, count: 0, users: [] };
      map[emoji].count++;
      map[emoji].users.push(user_id);
    });
    return Object.values(map);
  },
};

module.exports = Message;
