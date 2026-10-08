const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
const account = require('../controllers/account');

router.use(requireAuth);

router.get('/profile', asyncHandler(account.getProfile));
router.put('/profile', asyncHandler(account.updateProfile));
router.post('/password', asyncHandler(account.changePassword));
router.get('/preferences', asyncHandler(account.getPreferences));
router.put('/preferences', asyncHandler(account.updatePreferences));
router.post('/delete', asyncHandler(account.deleteAccount));

module.exports = router;
