/**
 * routes/dm.js – Direct Message routing
 */
const router  = require('express').Router();
const ctrl    = require('../controllers/dmController');
const { authenticate } = require('../middlewares/auth');
const { upload }       = require('../utils/storage');

router.use(authenticate);

router.get('/',          ctrl.getConversations);
router.get('/:userId',   ctrl.index);
router.post('/:userId',  upload.single('file'), ctrl.create);
router.patch('/:userId/read', ctrl.markRead);

module.exports = router;
