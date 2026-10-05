const express = require('express');
const { asyncHandler } = require('../middleware/error');
const categories = require('../controllers/categories');

const router = express.Router();

router.get('/', asyncHandler(categories.list));
router.get('/:slug', asyncHandler(categories.detail));

module.exports = router;
