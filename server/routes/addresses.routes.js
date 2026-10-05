const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const addresses = require('../controllers/addresses');

const router = express.Router();

router.get('/', asyncHandler(addresses.list));
router.post('/', asyncHandler(addresses.create));
router.patch('/:id', asyncHandler(addresses.update));
router.post('/:id/default', asyncHandler(addresses.makeDefault));
router.delete('/:id', asyncHandler(addresses.remove));

module.exports = router;