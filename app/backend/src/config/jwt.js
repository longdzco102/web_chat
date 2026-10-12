/**
 * config/jwt.js – JWT sign / verify helpers
 */
const jwt = require('jsonwebtoken');

const SECRET  = process.env.JWT_SECRET   || 'xianxia_secret_key';
const EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

module.exports = {
  sign(payload) {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES });
  },
  verify(token) {
    return jwt.verify(token, SECRET); // throws on invalid
  },
};
