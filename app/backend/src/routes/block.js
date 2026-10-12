/**
 * routes/block.js – Block/Unblock relationship routing
 */
const router  = require('express').Router();
const ctrl    = require('../controllers/blockController');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/',           ctrl.index);
router.post('/:userId',   ctrl.blockUser);
router.delete('/:userId', ctrl.unblockUser);

module.exports = router;
