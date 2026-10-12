/**
 * models/Channel.js – DB queries for channels
 */
const db = require('../config/db');

const Channel = {

  async findBySect(sectId) {
    const [rows] = await db.execute(
      'SELECT * FROM channels WHERE sect_id=? ORDER BY position ASC', [sectId]
    );
    return rows;
  },

  async findById(id) {
    const [rows] = await db.execute(
      'SELECT * FROM channels WHERE id=? LIMIT 1', [id]
    );
    return rows[0] ?? null;
  },

  async create({ sect_id, name, type = 'text', icon = '#', position = 0 }) {
    const [r] = await db.execute(
      'INSERT INTO channels (sect_id,name,type,icon,position) VALUES (?,?,?,?,?)',
      [sect_id, name, type, icon, position]
    );
    return r.insertId;
  },
};

module.exports = Channel;
