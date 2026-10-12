/**
 * utils/storage.js – Cloudinary upload helpers
 *
 * Free tier: 25 GB storage + 25 GB bandwidth/tháng
 * Docs: https://cloudinary.com/documentation/node_integration
 */
const cloudinary = require('../config/cloudinary');
const multer     = require('multer');
const logger     = require('./logger');

const BLOCKED_EXT = new Set(['exe', 'msi', 'bat', 'cmd', 'sh', 'vbs', 'scr', 'pif', 'com']);
const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

/**
 * Upload file (từ multer memoryStorage) lên Cloudinary.
 *
 * @param {Express.Multer.File} file   req.file
 * @param {string}              folder  e.g. 'avatars' | 'posts' | 'chat'
 * @returns {Promise<{ url: string, path: string }>}
 *   url  – HTTPS URL trực tiếp (có thể dùng luôn trong <img>)
 *   path – public_id của Cloudinary (dùng để xoá sau)
 */
async function uploadFile(file, folder = 'uploads') {
  if (!file) throw new Error('Không có file');

  const ext = file.originalname ? file.originalname.split('.').pop().toLowerCase() : '';
  if (BLOCKED_EXT.has(ext)) {
    const err = new Error(`Loại file không được phép vì lý do bảo mật: .${ext}`);
    err.status = 422;
    throw err;
  }
  if (file.size > MAX_BYTES) {
    const err = new Error('File vượt quá 10 MB');
    err.status = 422;
    throw err;
  }

  const baseName = file.originalname ? file.originalname.split('.').slice(0, -1).join('.') : 'file';
  const cleanName = baseName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
  const uniqueSuffix = Math.random().toString(36).substring(2, 9) + '_' + Date.now();
  
  const isImage = file.mimetype.startsWith('image/');
  const isVideo = file.mimetype.startsWith('video/');
  const isAudio = file.mimetype.startsWith('audio/');
  const resourceType = isImage ? 'image' : (isVideo || isAudio ? 'video' : 'raw');
  
  const publicId = (resourceType === 'raw' && ext) ? `${cleanName}_${uniqueSuffix}.${ext}` : `${cleanName}_${uniqueSuffix}`;

  // Cloudinary nhận stream từ buffer
  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        overwrite:     false,
        // Tự động tối ưu ảnh
        transformation: isImage
          ? [{ quality: 'auto', fetch_format: 'auto' }]
          : undefined,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(file.buffer);
  });

  logger.ok(`[storage] uploaded → ${result.public_id}  (${(file.size / 1024).toFixed(1)} KB)`);
  return {
    url:  result.secure_url,    // HTTPS URL
    path: result.public_id,     // public_id dùng để xoá
  };
}

/**
 * Xoá file khỏi Cloudinary theo public_id.
 * @param {string} publicId – e.g. 'avatars/abc123'
 */
async function deleteFile(publicId) {
  if (!publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: 'auto' });
    logger.info(`[storage] deleted ${publicId}`);
  } catch (e) {
    logger.warn(`[storage] delete failed ${publicId}:`, e.message);
  }
}

/**
 * multer middleware (memory – không lưu disk).
 * Sử dụng trong routes:
 *   const { upload } = require('../utils/storage');
 *   router.post('/posts', upload.single('cover'), ctrl.create);
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    const ext = file.originalname ? file.originalname.split('.').pop().toLowerCase() : '';
    cb(null, !BLOCKED_EXT.has(ext));
  },
});

module.exports = { uploadFile, deleteFile, upload };
