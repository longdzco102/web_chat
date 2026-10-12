/**
 * middlewares/auth.js – JWT authentication middleware
 */
const jwtHelper = require('../config/jwt');
const User      = require('../models/User');

/**
 * Protect route – requires valid Bearer token.
 * Attaches req.user = { id, name, email, realm, … }
 */
async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Chưa đăng nhập – cần Bearer token' });
  }
  try {
    const payload = jwtHelper.verify(header.slice(7));
    const user    = await User.findById(payload.id);
    if (!user) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

/**
 * Optional auth – attaches req.user if token present, else continues.
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      const payload = jwtHelper.verify(header.slice(7));
      req.user = await User.findById(payload.id);
    } catch { /* ignore */ }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
