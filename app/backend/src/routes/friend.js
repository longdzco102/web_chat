/**
 * routes/friend.js – Friends relationship routing
 */
const router  = require('express').Router();
const ctrl    = require('../controllers/friendController');
const { authenticate } = require('../middlewares/auth');

router.use(authenticate);

router.get('/',           ctrl.index);
router.post('/:userId',   ctrl.addFriend);
router.delete('/:userId', ctrl.removeFriend);
router.get('/:userId/check', ctrl.checkFriend);

module.exports = router;
