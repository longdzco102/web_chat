/**
 * config/cloudinary.js – Cloudinary SDK initialisation
 *
 * Free tier: 25 GB storage, 25 GB bandwidth/month
 * Lấy credentials: https://console.cloudinary.com → Dashboard
 */
const { v2: cloudinary } = require('cloudinary');
const logger = require('../utils/logger');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

// Verify config on startup
const cfg = cloudinary.config();
if (!cfg.cloud_name || !cfg.api_key || !cfg.api_secret) {
  logger.warn('[cloudinary] Thiếu credentials – upload sẽ thất bại. Kiểm tra .env');
} else {
  logger.ok(`☁️  Cloudinary   cloud=${cfg.cloud_name}`);
}

module.exports = cloudinary;
