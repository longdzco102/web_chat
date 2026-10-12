/**
 * routes/sects.js – với invite, kick, setRole, update, delete
 */
const router = require('express').Router();
const ctrl   = require('../controllers/sectController');
const { authenticate, optionalAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

router.get('/',             optionalAuth, ctrl.index);
router.get('/mine',         authenticate, ctrl.mine);
router.get('/:id',          optionalAuth, ctrl.show);
router.post('/',            authenticate, validate({ name:'required|min:2|max:100' }), ctrl.create);
router.patch('/:id',        authenticate, validate({ name:'required|min:2' }), ctrl.update);
router.delete('/:id',       authenticate, ctrl.destroy);
router.post('/:id/join',    authenticate, ctrl.join);
router.delete('/:id/leave', authenticate, ctrl.leave);
router.get('/:id/members',  optionalAuth, ctrl.members);
router.get('/:id/channels', optionalAuth, ctrl.channels);

// Group management (owner/truong_lao only)
router.post('/:id/invite',                authenticate, validate({ name:'required' }), ctrl.invite);
router.delete('/:id/kick/:userId',        authenticate, ctrl.kick);
router.patch('/:id/members/:userId/role', authenticate, validate({ role:'required' }), ctrl.setRole);

// Channel management (owner/truong_lao only)
router.post('/:id/channels',             authenticate, ctrl.createChannel);
router.patch('/:id/channels/:channelId', authenticate, ctrl.updateChannel);
router.delete('/:id/channels/:channelId',authenticate, ctrl.deleteChannel);

module.exports = router;
