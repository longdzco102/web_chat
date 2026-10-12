/**
 * routes/notifications.js
 */
const router = require('express').Router();
const ctrl = require('../controllers/notificationController');
const { authenticate } = require('../middlewares/auth');

router.get('/', authenticate, ctrl.index);
router.patch('/:id/read', authenticate, ctrl.markAsRead);
router.delete('/', authenticate, ctrl.clearAll);
router.post('/:id/accept', authenticate, ctrl.acceptInvite);
router.post('/:id/reject', authenticate, ctrl.rejectInvite);

module.exports = router;
