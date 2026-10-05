const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');
const orders = require('../controllers/orders');

const router = express.Router();

/**
 * Public tracking, deliberately registered before the auth guard: a customer
 * checking on a parcel is often not signed in, and this route authenticates
 * with the order number + matching email instead of a session.
 */
router.post('/lookup', asyncHandler(orders.lookupTracking));

/* Everything past this point requires a session. */
router.use(requireAuth);

router.get('/', asyncHandler(orders.listOrders));
router.get('/summary', asyncHandler(orders.summary));
router.get('/:orderNumber', asyncHandler(orders.getOrder));

module.exports = router;