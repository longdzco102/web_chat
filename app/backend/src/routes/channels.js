/**
 * routes/channels.js – messages + file/image upload + reactions
 */
const router = require('express').Router();
const ctrl   = require('../controllers/messageController');
const { authenticate } = require('../middlewares/auth');
const { validate }     = require('../middlewares/validate');
const { upload }       = require('../utils/storage');

// GET  /api/channels/:id/messages
router.get('/:id/messages', authenticate, ctrl.index);

// POST /api/channels/:id/messages  (text hoặc file)
router.post('/:id/messages',
  authenticate,
  upload.single('file'),   // optional file/image attachment
  ctrl.create);            // validate inside controller (content OR file)

// POST /api/channels/messages/:id/react
router.post('/messages/:id/react',
  authenticate,
  validate({ emoji:'required' }),
  ctrl.react);

module.exports = router;
