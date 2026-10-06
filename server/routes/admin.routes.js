const express = require('express');
const { asyncHandler } = require('../middleware/error');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * Admin surface.
 *
 * `requireAuth` then `requireAdmin` as two mounts, not one combined middleware,
 * so an anonymous caller is told to sign in (401) while a signed-in non-admin is
 * told they lack permission (403). Collapsing them would make the two cases
 * indistinguishable.
 *
 * These routes expose supplier cost and supplier ids, which the storefront must
 * never see, so the admin gate is not optional here.
 */
router.use(requireAuth);
router.use(requireAdmin);

const cj = require('../controllers/admin.cj');
const adminOrders = require('../controllers/admin.orders');
const adminCatalog = require('../controllers/admin.catalog');

router.get('/overview', asyncHandler(adminCatalog.overview));

router.get('/products', asyncHandler(adminCatalog.listProducts));
router.get('/products/:id', asyncHandler(adminCatalog.getProduct));
router.patch('/products/:id', asyncHandler(adminCatalog.updatePrice));

router.get('/cj/status', asyncHandler(cj.status));
router.get('/cj/sync/runs', asyncHandler(cj.listRuns));
router.post('/cj/sync', asyncHandler(cj.triggerSync));
router.get('/cj/preview', asyncHandler(cj.preview));
router.get('/cj/categories', asyncHandler(cj.upstreamCategories));
router.get('/cj/suppliers', asyncHandler(cj.supplierRows));

/* ---- order fulfilment (step 14) ------------------------------------------ */
// `/statuses` and `/summary` are declared before `/:orderNumber` so the literal
// segments are not captured as an order number.
router.get('/orders/statuses', asyncHandler(adminOrders.statusOptions));
router.get('/orders', asyncHandler(adminOrders.listOrders));
router.get('/orders/:orderNumber', asyncHandler(adminOrders.getOrder));
router.patch('/orders/:orderNumber/status', asyncHandler(adminOrders.updateStatus));
router.post('/orders/:orderNumber/cancel', asyncHandler(adminOrders.cancelOrder));

module.exports = router;