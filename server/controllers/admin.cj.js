/**
 * CJ sync administration.
 *
 * The whole router sits behind `requireAdmin`, because these endpoints expose
 * supplier-side information and can rewrite the catalogue.
 *
 * The trigger is deliberately fire-and-forget: a full Phase A run is ~60
 * sequential requests at CJ's 1 req/s limit, which is far longer than a browser
 * or a proxy will wait. The response returns immediately with a run id, and the
 * client polls /status.
 */

const config = require('../config');
const { HttpError } = require('../middleware/error');
const sync = require('../services/cj/sync');
const tokenStore = require('../services/cj/token');
const client = require('../services/cj/client');
const { query } = require('../database/pool');

/** GET /api/admin/cj/status — non-secret connection state + last runs. */
async function status(req, res) {
  const [auth, running, runs] = await Promise.all([
    tokenStore.status(),
    Promise.resolve(sync.isRunning()),
    sync.recentRuns(5),
  ]);

  res.json({
    ok: true,
    status: {
      configured: auth.configured,
      authenticated: auth.hasToken && !auth.expired,
      openId: auth.openId,
      tokenExpiresAt: auth.expiresAt,
      running,
      // Surfaced so an operator can see the real constraint they are working under.
      rateLimit: `${config.cj.minRequestIntervalMs}ms between requests (CJ allows 1/sec)`,
      maxVariantFetchesPerRun: config.cj.maxVariantFetchesPerRun,
      lastRuns: runs,
    },
  });
}

/** POST /api/admin/cj/sync — start a run. Returns immediately. */
async function triggerSync(req, res) {
  if (sync.isRunning()) throw HttpError.conflict('A sync is already running');

  // Verify we can actually authorise before promising anything, so an
  // unconfigured or rejected credential surfaces now rather than in a log.
  try {
    await tokenStore.getAccessToken();
  } catch (err) {
    throw HttpError.badRequest(`CJ authentication failed: ${err.message}`);
  }

  const triggeredBy = req.user.id;

  // Intentionally not awaited: see the note above.
  sync
    .runSync({ triggeredBy })
    .catch((err) => console.error('[cj] background sync failed:', err.message));

  res.status(202).json({
    ok: true,
    message: 'Sync started. This takes about a minute per 100 products.',
  });
}

/** GET /api/admin/cj/sync/runs — sync history. */
async function listRuns(req, res) {
  const items = await sync.recentRuns(req.query.limit);
  res.json({ ok: true, items });
}

/**
 * GET /api/admin/cj/preview — one page of raw upstream products.
 *
 * This is the diagnostic view: it shows CJ's own cost alongside our computed
 * sell price, which is exactly what an operator needs to sanity-check the
 * margin. It is admin-only, and it reads from CJ rather than our database so it
 * can be used to inspect something before importing it.
 */
async function preview(req, res) {
  const { page = 1, size = 5 } = req.query;
  const result = await client.listProducts({
    page: Number(page) || 1,
    size: Math.min(Number(size) || 5, 20),
    features: ['enable_description', 'enable_category'],
  });

  const mapper = require('../services/cj/mapper');

  res.json({
    ok: true,
    page: result.pageNumber,
    totalRecords: result.totalRecords,
    totalPages: result.totalPages,
    items: result.products.map((p) => {
      const mapped = mapper.mapProduct(p);
      return {
        supplierProductId: mapped.supplier.supplier_product_id,
        name: mapped.product.name,
        // Admin-only: the supplier cost, which the storefront never exposes.
        supplierCost: mapped.supplier.cost_price,
        supplierStock: mapped.supplier.supplier_stock,
        ourSellPrice: mapped.product.price,
        marginPercent:
          Number(mapped.supplier.cost_price) > 0
            ? (
                ((Number(mapped.product.price) - Number(mapped.supplier.cost_price)) /
                  Number(mapped.product.price)) *
                100
              ).toFixed(1)
            : null,
        stock: mapped.product.stock,
      };
    }),
  });
}

/** GET /api/admin/cj/categories — the upstream category tree. */
async function upstreamCategories(req, res) {
  const tree = await client.listCategories();
  const flat = [];
  for (const first of tree) {
    for (const second of first.categoryFirstList || []) {
      for (const third of second.categorySecondList || []) {
        flat.push({
          first: first.categoryFirstName,
          second: second.categorySecondName,
          third: third.categoryName,
          categoryId: third.categoryId,
        });
      }
    }
  }
  res.json({ ok: true, items: flat });
}

/** GET /api/admin/cj/suppliers — supplier-side rows for the products we sell. */
async function supplierRows(req, res) {
  const rows = await query(
    `SELECT p.id, p.name, p.slug, p.price, p.stock,
            ps.supplier_product_id, ps.supplier_sku, ps.supplier_name,
            ps.cost_price, ps.shipping_cost, ps.supplier_stock, ps.last_synced_at
       FROM product_supplier ps
       JOIN products p ON p.id = ps.product_id
      ORDER BY ps.last_synced_at DESC, p.id DESC
      LIMIT ?`,
    [Math.min(Number(req.query.limit) || 50, 200)]
  );

  res.json({
    ok: true,
    items: rows.map((r) => ({
      productId: String(r.id),
      name: r.name,
      slug: r.slug,
      sellPrice: Number(r.price),
      stock: Number(r.stock),
      supplierProductId: r.supplier_product_id,
      supplierSku: r.supplier_sku,
      supplierName: r.supplier_name,
      costPrice: Number(r.cost_price),
      shippingCost: Number(r.shipping_cost),
      supplierStock: Number(r.supplier_stock),
      lastSyncedAt: r.last_synced_at,
    })),
  });
}

module.exports = { status, triggerSync, listRuns, preview, upstreamCategories, supplierRows };