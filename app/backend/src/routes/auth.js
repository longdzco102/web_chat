/**
 * routes/auth.js – với avatar upload
 */
const router  = require('express').Router();
const ctrl    = require('../controllers/authController');
const { authenticate }       = require('../middlewares/auth');
const { validate }           = require('../middlewares/validate');
const { upload }             = require('../utils/storage');

router.post('/register',
  upload.single('avatar'),   // optional avatar
  validate({ name:'required|min:2|max:50', email:'required|email', password:'required|min:6' }),
  ctrl.register);

router.post('/login',
  validate({ email:'required|email', password:'required' }),
  ctrl.login);

router.get('/me',             authenticate, ctrl.me);
router.get('/users/search',   authenticate, ctrl.searchUsers);
router.get('/users/:id',      authenticate, ctrl.getUser);
router.post('/logout',        authenticate, ctrl.logout);
router.patch('/avatar',       authenticate, upload.single('avatar'), ctrl.updateAvatar);
router.patch('/settings',     authenticate, upload.single('avatar'), ctrl.updateSettings);

module.exports = router;
