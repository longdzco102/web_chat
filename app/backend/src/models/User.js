/**
 * models/User.js – TiDB version, uses realmSystem config
 */
const db     = require('../config/db');
const bcrypt = require('bcryptjs');
const { REALM_SYSTEM, getRealmByIndex } = require('../config/realmSystem');

const SAFE_COLS = 'id,name,email,avatar_url,gender,realm,realm_index,exp,status,role,created_at';

const User = {

  async create({ name, email, password, avatarUrl = null, avatarPath = null }) {
    const hash = await bcrypt.hash(password, 10);
    const [r] = await db.execute(
      'INSERT INTO users (name,email,password,avatar_url,avatar_path,realm,realm_index,exp) VALUES (?,?,?,?,?,?,?,?)',
      [name, email, hash, avatarUrl, avatarPath, REALM_SYSTEM[0].name, 0, 0]
    );
    return r.insertId;
  },

  async findByEmail(email) {
    const [rows] = await db.execute('SELECT * FROM users WHERE email=? LIMIT 1', [email]);
    return rows[0] ?? null;
  },

  async findByName(name) {
    const [rows] = await db.execute('SELECT * FROM users WHERE LOWER(name)=LOWER(?) LIMIT 1', [name]);
    return rows[0] ?? null;
  },

  async search(query) {
    const q = `%${query}%`;
    const [rows] = await db.execute(
      `SELECT ${SAFE_COLS} FROM users WHERE name LIKE ? OR email LIKE ? LIMIT 20`,
      [q, q]
    );
    return rows.map(r => User.toPublic(r));
  },

  async findById(id) {
    const [rows] = await db.execute(`SELECT ${SAFE_COLS} FROM users WHERE id=? LIMIT 1`, [id]);
    return rows[0] ?? null;
  },

  async checkPassword(plain, hash) {
    return bcrypt.compare(plain, hash);
  },

  async setStatus(id, status) {
    await db.execute('UPDATE users SET status=? WHERE id=?', [status, id]);
  },

  async updateSettings(id, { name, avatarUrl, avatarPath, gender }) {
    const fields = [];
    const values = [];

    if (name) { fields.push('name=?'); values.push(name); }
    if (avatarUrl) { fields.push('avatar_url=?'); values.push(avatarUrl); }
    if (avatarPath) { fields.push('avatar_path=?'); values.push(avatarPath); }
    if (gender) { fields.push('gender=?'); values.push(gender); }
    
    values.push(id);
    await db.execute(
      `UPDATE users SET ${fields.join(',')} WHERE id=?`,
      values
    );
  },

  async updateAvatar(id, avatarUrl, avatarPath) {
    await db.execute(
      'UPDATE users SET avatar_url=?,avatar_path=? WHERE id=?',
      [avatarUrl, avatarPath, id]
    );
  },

  /**
   * Grant EXP. Returns { exp, realm_index, realm, maxExp, realmCss }.
   * Does NOT auto-breakthrough — player must press the Breakthrough button.
   * EXP is capped at maxExp (no overflow to next level).
   */
  async gainExp(id, amount) {
    const user = await User.findById(id);
    if (!user) return null;

    const realmIdx = user.realm_index ?? 0;
    const realm    = getRealmByIndex(realmIdx);
    const newExp   = Math.min((user.exp ?? 0) + amount, realm.maxExp);

    await db.execute(
      'UPDATE users SET exp=? WHERE id=?',
      [newExp, id]
    );

    return {
      exp:        newExp,
      realm:      realm.name,
      realm_index: realmIdx,
      maxExp:     realm.maxExp,
      realmCss:   realm.css,
      gender:     user.gender
    };
  },

  /**
   * Set EXP directly (used for breakthrough fail penalty).
   */
  async setExp(id, exp) {
    await db.execute('UPDATE users SET exp=? WHERE id=?', [Math.max(0, exp), id]);
  },

  /**
   * Breakthrough: advance to next realm, reset EXP to 0.
   */
  async breakthrough(id, newRealmIndex, newRealmName) {
    await db.execute(
      'UPDATE users SET realm_index=?,realm=?,exp=0 WHERE id=?',
      [newRealmIndex, newRealmName, id]
    );
  },

  toPublic(user) {
    const { password: _, avatar_path: __, ...safe } = user;
    // Attach realm CSS class
    const realm = getRealmByIndex(safe.realm_index ?? 0);
    safe.realmCss = realm.css;
    safe.maxExp   = realm.maxExp;
    safe.avatar_url = safe.avatar_url || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
    safe.gender = safe.gender || 'kho_noi';
    return safe;
  },
};

module.exports = User;
