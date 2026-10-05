const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const cart = require('../controllers/cart');
const checkout = require('../controllers/checkout');

/* ---- cart: guests allowed, the session cookie identifies the basket ------ */
router.get('/cart', asyncHandler(cart.getCart));
router.post('/cart/items', asyncHandler(cart.addItem));
router.patch('/cart/items/:itemId', asyncHandler(cart.updateItem));
router.delete('/cart/items/:itemId', asyncHandler(cart.removeItem));
router.delete('/cart', asyncHandler(cart.clearCart));

/* ---- checkout: guests may check out, which is normal for a store --------- */
router.get('/checkout/shipping-methods', asyncHandler(checkout.shippingMethods));
router.post('/checkout/quote', asyncHandler(checkout.quote));
router.post('/checkout/place-order', asyncHandler(checkout.placeOrder));

/* ---- authenticated areas -------------------------------------------------
 * `requireAuth` is attached with a path prefix on each mount, NOT as a bare
 * `router.use(requireAuth)`. A blanket use() also runs for paths that match no
 * route, so every unknown /api URL would answer 401 and never reach the 404
 * handler. Prefix mounts only run the guard when the prefix actually matches.
 *
 * The orders router guards itself internally, because its /lookup route is
 * intentionally public.
 */
router.use('/addresses', requireAuth, require('./addresses.routes'));
router.use('/orders', require('./orders.routes'));
router.use('/wishlist', requireAuth, require('./wishlist.routes'));

module.exports = router;