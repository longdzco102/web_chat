/**
 * routes/posts.js – với cover image upload
 */
const router = require('express').Router();
const ctrl   = require('../controllers/postController');
const { authenticate, optionalAuth } = require('../middlewares/auth');
const { validate }  = require('../middlewares/validate');
const { upload }    = require('../utils/storage');

router.get('/',          optionalAuth,  ctrl.index);
router.get('/:id',       optionalAuth,  ctrl.show);

router.post('/',
  authenticate,
  upload.single('cover'),    // optional cover image
  validate({ title:'required|min:3|max:255', content:'required|min:10', tag:'required' }),
  ctrl.create);

router.delete('/:id',         authenticate, ctrl.destroy);
router.post('/:id/like',      authenticate, ctrl.toggleLike);
router.get('/:id/comments',   optionalAuth,  ctrl.getComments);
router.post('/:id/comments',
  authenticate,
  validate({ content:'required|min:1' }),
  ctrl.addComment);

module.exports = router;
