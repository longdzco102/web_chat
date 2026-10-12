/**
 * middlewares/errorHandler.js – Global Express error handler
 */
const logger = require('../utils/logger');

// 404 – No route matched
function notFound(req, res) {
  res.status(404).json({ error: `Không tìm thấy: ${req.method} ${req.originalUrl}` });
}

// 500 – Unhandled errors
function errorHandler(err, req, res, _next) {
  logger.error(err.message, err.stack?.split('\n')[1]?.trim());
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: status === 500 ? 'Lỗi máy chủ nội bộ' : err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = { notFound, errorHandler };
