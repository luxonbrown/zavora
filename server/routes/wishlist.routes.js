const express = require('express');
const { asyncHandler } = require('../middleware/error');
const wishlist = require('../controllers/wishlist');

const router = express.Router();

router.get('/', asyncHandler(wishlist.list));
router.post('/', asyncHandler(wishlist.toggle));
router.delete('/:productId', asyncHandler(wishlist.remove));

module.exports = router;