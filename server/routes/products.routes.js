const express = require('express');
const { asyncHandler } = require('../middleware/error');
const products = require('../controllers/products');

const router = express.Router();

router.get('/', asyncHandler(products.list));

// These must be declared before "/:slug" so the literal segments are not
// swallowed by the parameterised route.
router.get('/trending', asyncHandler(products.trending));
router.get('/search', asyncHandler(products.search));

router.get('/:slug', asyncHandler(products.detail));
router.get('/:slug/related', asyncHandler(products.related));
router.get('/:slug/reviews', asyncHandler(products.reviews));

module.exports = router;
