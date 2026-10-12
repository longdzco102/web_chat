/**
 * models/Sect.js – TiDB version with full group management
 */
const db = require('../config/db');

const Sect = {

  async findAll() {
    const [rows] = await db.execute(`
      SELECT s.*, u.name AS owner_name,
             (SELECT COUNT(*) FROM sect_members sm WHERE sm.sect_id=s.id) AS member_count
      FROM sects s JOIN users u ON u.id=s.owner_id
      ORDER BY s.created_at DESC`);
    return rows;
  },

  async findByUser(userId) {
    const [rows] = await db.execute(`
      SELECT s.*,
             sm.role AS user_role,
             (sm.role = 'tong_chu') AS isOwner,
             (SELECT COUNT(*) FROM sect_members m WHERE m.sect_id=s.id) AS member_count
      FROM sects s
      JOIN sect_members sm ON sm.sect_id=s.id AND sm.user_id=?
      ORDER BY s.created_at DESC`, [userId]);
    // Convert isOwner bigint → bool
    return rows.map(r => ({ ...r, isOwner: !!r.isOwner }));
  },

  async findById(id) {
    const [rows] = await db.execute(`
      SELECT s.*, u.name AS owner_name,
             (SELECT COUNT(*) FROM sect_members sm WHERE sm.sect_id=s.id) AS member_count
      FROM sects s JOIN users u ON u.id=s.owner_id WHERE s.id=? LIMIT 1`, [id]);
    return rows[0] ?? null;
  },

  async create({ name, icon, description, owner_id }) {
    const [r] = await db.execute(
      'INSERT INTO sects (name,icon,description,owner_id) VALUES (?,?,?,?)',
      [name, icon ?? '🐉', description ?? '', owner_id]
    );
    return r.insertId;
  },

  async update(id, { name, icon, description }) {
    const fields = [];
    const vals   = [];
    if (name !== undefined)        { fields.push('name=?');        vals.push(name); }
    if (icon !== undefined)        { fields.push('icon=?');        vals.push(icon); }
    if (description !== undefined) { fields.push('description=?'); vals.push(description); }
    if (!fields.length) return;
    vals.push(id);
    await db.execute(`UPDATE sects SET ${fields.join(',')} WHERE id=?`, vals);
  },

  async destroy(id) {
    // Delete channels first, then members, then sect
    await db.execute('DELETE FROM channels     WHERE sect_id=?', [id]);
    await db.execute('DELETE FROM sect_members WHERE sect_id=?', [id]);
    await db.execute('DELETE FROM sects        WHERE id=?',      [id]);
  },

  // ── Members ──────────────────────────────────────────────────
  async getMembers(sectId) {
    const [rows] = await db.execute(`
      SELECT sm.role, sm.joined_at,
             u.id, u.name, u.avatar_url AS avatar, u.realm, u.realm_index, u.status
      FROM sect_members sm JOIN users u ON u.id=sm.user_id
      WHERE sm.sect_id=? ORDER BY sm.role='tong_chu' DESC, sm.role='truong_lao' DESC, u.name`,
      [sectId]);
    return rows;
  },

  async getMember(sectId, userId) {
    const [rows] = await db.execute(
      'SELECT * FROM sect_members WHERE sect_id=? AND user_id=? LIMIT 1',
      [sectId, userId]
    );
    return rows[0] ?? null;
  },

  async addMember(sectId, userId, role = 'de_tu') {
    await db.execute(
      'INSERT IGNORE INTO sect_members (sect_id,user_id,role) VALUES (?,?,?)',
      [sectId, userId, role]
    );
  },

  async removeMember(sectId, userId) {
    await db.execute(
      'DELETE FROM sect_members WHERE sect_id=? AND user_id=?',
      [sectId, userId]
    );
  },

  async setMemberRole(sectId, userId, role) {
    await db.execute(
      'UPDATE sect_members SET role=? WHERE sect_id=? AND user_id=?',
      [role, sectId, userId]
    );
  },

  async isMember(sectId, userId) {
    const m = await Sect.getMember(sectId, userId);
    return m !== null;
  },
};

module.exports = Sect;
