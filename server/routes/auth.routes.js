const express = require('express');
const { asyncHandler } = require('../middleware/error');
const auth = require('../controllers/auth');

const router = express.Router();

router.post('/register', asyncHandler(auth.register));
router.post('/login', asyncHandler(auth.login));
router.post('/logout', asyncHandler(auth.logout));
router.post('/forgot-password', asyncHandler(auth.forgotPassword));
router.get('/me', asyncHandler(auth.me));

module.exports = router;
