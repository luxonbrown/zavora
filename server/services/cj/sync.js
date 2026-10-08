/**
 * CJ catalogue sync.
 *
 * Two phases, because the rate limit dictates the shape:
 *
 *   Phase A — LIST. Page through `product/listV2` (100 per page, so 6000
 *   products is 60 requests, roughly a minute at 1 req/s) and upsert every
 *   product, its image, its category and its supplier row.
 *
 *   Phase B — ENRICH. Fetching variants costs one extra request per product.
 *   At 1 req/s a full pass over 6000 products would take well over an hour, so
 *   each run enriches at most `maxVariantFetchesPerRun` products, preferring
 *   ones that have never been enriched. Repeated runs make progress; no single
 *   run blocks the API for an hour.
 *
 * Every run writes a `cj_sync_logs` row, so a partial or failed run is visible
 * rather than silent.
 */

const crypto = require('crypto');
const config = require('../../config');
const { withTransaction, query, execute } = require('../../database/pool');
const client = require('./client');
const mapper = require('./mapper');
const tokenStore = require('./token');

/** Runs in this process, so a second trigger cannot double-insert. */
let running = false;

function isRunning() {
  return running;
}

async function beginLog(triggeredBy) {
  const runId = `run_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const result = await execute(
    `INSERT INTO cj_sync_logs (run_id, status, triggered_by, started_at)
     VALUES (?, 'running', ?, NOW())`,
    [runId, triggeredBy ?? null]
  );
  return { runId, id: result.insertId };
}

async function finishLog(id, stats, error) {
  const status = error ? 'failed' : stats.skipped > 0 ? 'partial' : 'success';
  await execute(
    `UPDATE cj_sync_logs
        SET status = ?, pages_fetched = ?, products_seen = ?, products_created = ?,
            products_updated = ?, products_skipped = ?, products_failed = ?,
            error_message = ?, finished_at = NOW()
      WHERE id = ?`,
    [
      status,
      stats.pagesFetched || 0,
      stats.seen || 0,
      stats.created || 0,
      stats.updated || 0,
      stats.skipped || 0,
      stats.failed || 0,
      error ? String(error.message || error).slice(0, 2000) : null,
      id,
    ]
  );
  return status;
}

/* ---- categories ---------------------------------------------------------- */

/**
 * Ensure a full category path exists and return the LEAF id.
 *
 * CJ exposes three levels (`oneCategoryName`, `twoCategoryName`,
 * `threeCategoryName`). Products are attached to the most specific level, and
 * each level points at its parent via `categories.parent_id`, so the storefront
 * can present a real tree instead of a flat list of hundreds of leaves.
 *
 * Ids are cached for the duration of a run: a 6,000-product import touches the
 * same few hundred categories over and over, and a query per product per level
 * would dominate the runtime.
 */
const categoryCache = new Map(); // path key -> leaf id
let positionCursor = null;

/** Stable, collision-resistant slug for a category at a given depth. */
function categorySlug(name, depth, parentSlug) {
  const base = String(name)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  // Including the parent path keeps "Tops" under Women distinct from "Tops"
  // under Men, which a bare name-based slug would collide.
  return parentSlug ? `${parentSlug}-${base}` : (base || `level-${depth}`);
}

async function nextPosition() {
  if (positionCursor === null) {
    const rows = await query('SELECT COALESCE(MAX(position), 0) AS maxPos FROM categories');
    positionCursor = Number(rows[0].maxPos);
  }
  positionCursor += 1;
  return positionCursor;
}

/**
 * Create/resolve one level. Returns its id.
 */
async function upsertCategory(name, depth, parentId, parentSlug) {
  const clean = String(name || '').trim().slice(0, 120);
  if (!clean) return null;

  const slug = categorySlug(clean, depth, parentSlug);
  const key = `${parentId || 'root'}/${slug}`;

  if (categoryCache.has(key)) return categoryCache.get(key);

  const existing = await query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [slug]);
  if (existing.length) {
    categoryCache.set(key, existing[0].id);
    return existing[0].id;
  }

  const position = await nextPosition();
  const result = await execute(
    'INSERT INTO categories (parent_id, name, slug, tagline, position, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [parentId, clean, slug, depth === 1 ? 'Synced from CJdropshipping' : '', position]
  );

  categoryCache.set(key, result.insertId);
  return result.insertId;
}

/**
 * Resolve the three CJ category names on a product into a leaf category id.
 * Missing levels are tolerated — a product with only `oneCategoryName` lands
 * directly under the root rather than being dropped.
 */
async function ensureCategoryPath(cjProduct) {
  const level1 = await upsertCategory(cjProduct.oneCategoryName, 1, null, null);
  if (!level1) return null;

  const slug1 = categorySlug(cjProduct.oneCategoryName, 1, null);
  const level2Name = cjProduct.twoCategoryName;
  if (!level2Name) return level1;

  const level2 = await upsertCategory(level2Name, 2, level1, slug1);
  if (!level2) return level1;

  const slug2 = categorySlug(level2Name, 2, slug1);
  const level3Name = cjProduct.threeCategoryName;
  if (!level3Name) return level2;

  const level3 = await upsertCategory(level3Name, 3, level2, slug2);
  return level3 || level2;
}

/* ---- product upsert ------------------------------------------------------ */

/**
 * Insert or update one product plus its supplier row and image.
 * Returns 'created' | 'updated' | 'skipped'.
 */
async function upsertProduct(cjProduct) {
  const { product, supplier, image, sync_hash: syncHash, importable } = mapper.mapProduct(cjProduct);
  const cjId = supplier.supplier_product_id;

  const existing = await query(
    `SELECT p.id AS product_id, ps.sync_hash
       FROM product_supplier ps
       JOIN products p ON p.id = ps.product_id
      WHERE ps.supplier = 'cj' AND ps.supplier_product_id = ?
      LIMIT 1`,
    [cjId]
  );

  // A listing with no usable price cannot be sold. If we previously imported it
  // (before this rule existed) take it off sale rather than leaving it at $0.
  if (!importable) {
    if (existing.length) await archiveRemovedProduct(existing[0].product_id, cjId);
    return 'skipped';
  }

  // Products hang off the most specific CJ category level available.
  const categoryId = await ensureCategoryPath(cjProduct);

  if (!existing.length) {
    return withTransaction(async (conn) => {
      const [res] = await conn.execute(
        `INSERT INTO products
           (category_id, name, slug, sku, brand, short_description, description,
            price, compare_at_price, rating, review_count, stock,
            status, is_active, published_at)
         VALUES (?, ?, ?, ?, 'ZAVORA', ?, ?, ?, NULL, 0, 0, ?, 'active', 1, ?)`,
        [
          categoryId,
          product.name,
          product.slug,
          product.sku,
          product.short_description,
          product.description,
          product.price,
          product.stock,
          product.published_at,
        ]
      );
      const productId = res.insertId;

      await conn.execute(
        `INSERT INTO product_supplier
           (product_id, supplier, supplier_product_id, supplier_sku, supplier_name,
            supplier_url, cost_price, shipping_cost, supplier_stock, sync_hash, last_synced_at)
         VALUES (?, 'cj', ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          productId,
          cjId,
          supplier.supplier_sku,
          supplier.supplier_name,
          supplier.supplier_url,
          supplier.cost_price,
          supplier.shipping_cost,
          supplier.supplier_stock,
          syncHash,
        ]
      );

      if (image.url) {
        await conn.execute(
          'INSERT INTO product_images (product_id, url, alt, position, is_primary) VALUES (?, ?, ?, 0, 1)',
          [productId, image.url, image.alt]
        );
      }
      return 'created';
    });
  }

  const { product_id: productId, sync_hash: oldHash } = existing[0];

  // Nothing upstream changed: skip the write entirely.
  if (oldHash === syncHash) return 'skipped';

  return withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE products SET
         category_id = ?, name = ?, short_description = ?, description = ?,
         price = ?, stock = ?, published_at = ?
       WHERE id = ?`,
      [
        categoryId,
        product.name,
        product.short_description,
        product.description,
        product.price,
        product.stock,
        product.published_at,
        productId,
      ]
    );

    await conn.execute(
      `UPDATE product_supplier SET
         supplier_sku = ?, supplier_name = ?, supplier_url = ?,
         cost_price = ?, shipping_cost = ?, supplier_stock = ?,
         sync_hash = ?, last_synced_at = NOW()
       WHERE product_id = ? AND supplier = 'cj'`,
      [
        supplier.supplier_sku,
        supplier.supplier_name,
        supplier.supplier_url,
        supplier.cost_price,
        supplier.supplier_stock,
        syncHash,
        productId,
      ]
    );

    // Refresh the primary image only when it actually changed.
    if (image.url) {
      const current = await conn.query(
        'SELECT url FROM product_images WHERE product_id = ? AND is_primary = 1 LIMIT 1',
        [productId]
      );
      if (!current.length || current[0][0].url !== image.url) {
        await conn.query('DELETE FROM product_images WHERE product_id = ?', [productId]);
        await conn.execute(
          'INSERT INTO product_images (product_id, url, alt, position, is_primary) VALUES (?, ?, ?, 0, 1)',
          [productId, image.url, image.alt]
        );
      }
    }
    return 'updated';
  });
}

/* ---- phase B: variants --------------------------------------------------- */

/**
 * Fetch and store variants for one product. Runs inside the caller's
 * transaction-free path, so it is individually fault-tolerant.
 */
async function enrichVariants(productId) {
  const row = await query(
    `SELECT ps.supplier_product_id, ps.supplier_variant_id
       FROM product_supplier ps
      WHERE ps.product_id = ? AND ps.supplier = 'cj' LIMIT 1`,
    [productId]
  );
  if (!row.length) return 0;
  const cjId = row[0].supplier_product_id;

  let detail;
  try {
    detail = await client.getProductDetail(cjId);
  } catch (err) {
    // CJ delists products. Retrying forever would burn the 1 req/s budget on a
    // product that will never come back, so archive it and move on.
    if (err.cjCode === client.CJ_CODES.PRODUCT_REMOVED) {
      await archiveRemovedProduct(productId, cjId);
      return 0;
    }
    throw err;
  }

  const variants = mapper.mapVariants(detail);

  // Mark first: a product with no variants must not be retried forever.
  await markVariantsSynced(productId);
  if (!variants.length) return 0;

  await withTransaction(async (conn) => {
    for (const v of variants) {
      await conn.execute(
        `INSERT INTO product_variants
           (product_id, name, option_type, option_value, sku, price, stock,
            supplier_variant_id, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           option_type = VALUES(option_type),
           stock = VALUES(stock),
           supplier_variant_id = VALUES(supplier_variant_id),
           position = VALUES(position)`,
        [productId, v.name, v.option_type, v.option_value, v.sku, v.price, v.stock, v.supplier_variant_id, v.position]
      );
    }
  });

  return variants.length;
}

/**
 * Take a product off sale when CJ says it no longer exists, or when it has no
 * usable price.
 *
 * `is_active = 0` rather than a hard delete: it may still appear in historical
 * orders, and `order_items` snapshots protect that history either way. Archiving
 * keeps the row for auditing while removing it from every public listing.
 */
async function archiveRemovedProduct(productId, cjId) {
  await withTransaction(async (conn) => {
    await conn.execute(
      "UPDATE products SET is_active = 0, status = 'archived' WHERE id = ?",
      [productId]
    );
    await conn.execute(
      `UPDATE product_supplier SET variants_synced_at = NOW(), supplier_stock = 0
        WHERE product_id = ? AND supplier = 'cj'`,
      [productId]
    );
    // Anyone holding it in a cart needs to know, which the cart surfaces via
    // its `issues` list once the product is no longer active.
    await conn.execute('DELETE FROM cart_items WHERE product_id = ?', [productId]);
  });
  console.warn(`[cj] product ${cjId} (id ${productId}) removed upstream — archived`);
}

/** Mark a product's variants as fetched, even when it genuinely has none. */
async function markVariantsSynced(productId) {
  await execute(
    `UPDATE product_supplier SET variants_synced_at = NOW()
      WHERE product_id = ? AND supplier = 'cj'`,
    [productId]
  );
}

/** Products never yet enriched, oldest first. Bounded by the caller's limit. */
async function productsNeedingVariants(limit) {
  return query(
    `SELECT p.id
       FROM products p
       JOIN product_supplier ps ON ps.product_id = p.id AND ps.supplier = 'cj'
      WHERE ps.variants_synced_at IS NULL
      ORDER BY ps.last_synced_at ASC, p.id ASC
      LIMIT ?`,
    [limit]
  );
}

/* ---- the run ------------------------------------------------------------- */

/**
 * Execute a full sync. Never throws for an individual product failure — those
 * are counted and logged — but a catalogue-level failure (auth, rate limit
 * exhausted) does throw, so the log row records `failed` rather than pretending
 * success.
 */
async function runSync({ triggeredBy = null, maxPages = config.cj.maxPages } = {}) {
  if (running) {
    const err = new Error('A sync is already running');
    err.status = 409;
    throw err;
  }
  running = true;

  const { runId, id: logId } = await beginLog(triggeredBy);
  const stats = { pagesFetched: 0, seen: 0, created: 0, updated: 0, skipped: 0, failed: 0 };

  try {
    // ---- Phase 0: import the upstream category tree ----
    // CJ exposes the full first → second → third level tree separately from
    // the product list, so we mirror it instead of deriving categories only
    // from whatever products happen to be listed.
    try {
      const tree = await client.listCategories();
      for (const first of tree) {
        const level1Id = await upsertCategory(first.categoryFirstName, 1, null, null);
        const slug1 = level1Id !== null ? categorySlug(first.categoryFirstName, 1, null) : null;
        for (const second of first.categoryFirstList || []) {
          const level2Id = await upsertCategory(second.categorySecondName, 2, level1Id, slug1);
          const slug2 = level2Id !== null ? categorySlug(second.categorySecondName, 2, slug1) : null;
          for (const third of second.categorySecondList || []) {
            await upsertCategory(third.categoryName, 3, level2Id, slug2);
          }
        }
      }
      console.log('[cj] category tree imported');
    } catch (err) {
      // A category import failure must not block product sync: the product
      // path derives categories itself via ensureCategoryPath.
      console.error(`[cj] category tree import failed: ${err.message}`);
    }

    // ---- Phase A: list ----
    let page = 1;
    let totalPages = 1;

    while (page <= Math.min(maxPages, totalPages)) {
      const result = await client.listProducts({
        page,
        size: config.cj.pageSize,
        // Descriptions and category names are needed for the storefront copy.
        features: ['enable_description', 'enable_category'],
      });

      stats.pagesFetched = page;
      totalPages = result.totalPages || 1;
      const batch = result.products;
      stats.seen += batch.length;

      for (const cjProduct of batch) {
        try {
          const outcome = await upsertProduct(cjProduct);
          stats[outcome] += 1;
        } catch (err) {
          // One bad product must not abort a 6000-product run.
          stats.failed += 1;
          console.error(`[cj] product ${cjProduct?.id} failed: ${err.message}`);
        }
      }

      if (batch.length === 0) break;
      page += 1;
    }

    // ---- Phase B: variants (bounded) ----
    const pending = await productsNeedingVariants(config.cj.maxVariantFetchesPerRun);
    let enriched = 0;
    for (const { id } of pending) {
      try {
        enriched += await enrichVariants(id);
      } catch (err) {
        console.error(`[cj] variant fetch for product ${id} failed: ${err.message}`);
      }
    }
    stats.variants = enriched;

    const status = await finishLog(logId, stats, null);
    return { runId, status, ...stats };
  } catch (err) {
    await finishLog(logId, stats, err);
    throw err;
  } finally {
    running = false;
  }
}

/** Recent sync runs, newest first, for the admin UI. */
async function recentRuns(limit = 20) {
  const rows = await query(
    `SELECT l.run_id, l.status, l.pages_fetched, l.products_seen, l.products_created,
            l.products_updated, l.products_skipped, l.products_failed,
            l.error_message, l.started_at, l.finished_at,
            u.email AS triggered_by_email
       FROM cj_sync_logs l
       LEFT JOIN users u ON u.id = l.triggered_by
      ORDER BY l.id DESC
      LIMIT ?`,
    [Math.min(Number(limit) || 20, 100)]
  );

  return rows.map((r) => ({
    runId: r.run_id,
    status: r.status,
    pagesFetched: Number(r.pages_fetched),
    productsSeen: Number(r.products_seen),
    productsCreated: Number(r.products_created),
    productsUpdated: Number(r.products_updated),
    productsSkipped: Number(r.products_skipped),
    productsFailed: Number(r.products_failed),
    error: r.error_message,
    startedAt: r.started_at,
    finishedAt: r.finished_at,
    triggeredBy: r.triggered_by_email,
  }));
}

module.exports = {
  runSync,
  recentRuns,
  isRunning,
  ensureCategoryPath,
  upsertCategory,
  upsertProduct,
  enrichVariants,
  markVariantsSynced,
  archiveRemovedProduct,
};