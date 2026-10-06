/**
 * Admin catalogue + overview endpoints.
 *
 * These are the only places supplier cost is ever sent to a browser, and they
 * sit behind `requireAdmin`. The storefront has no equivalent — see the note in
 * lib/catalog.js about why public product SQL cannot reference product_supplier.
 */

const { query, queryOne, execute } = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { decimal } = require('../lib/money');
const { isOpen } = require('../lib/orderStatus');
const catalog = require('../lib/catalog');
const sync = require('../services/cj/sync');
const tokenStore = require('../services/cj/token');

/** GET /api/admin/overview — the dashboard's headline figures. */
async function overview(req, res) {
  // Rollup counts come from the shared tree builder rather than a direct join:
  // top-level categories hold no products of their own (products live on leaves),
  // so joining on category_id alone would report every branch as zero.
  const { tree } = await catalog.listCategoryTree({ maxDepth: 1 });

  const [totals, revenue, financials, orderCounts, statusCounts, recent, lowStock, cj, bestSelling, mostProfitable, byDate] =
    await Promise.all([
    queryOne(
      `SELECT
         (SELECT COUNT(*) FROM products WHERE is_active = 1) AS active_products,
         (SELECT COUNT(*) FROM products WHERE is_active = 0) AS archived_products,
         (SELECT COUNT(*) FROM product_variants) AS variants,
         (SELECT COUNT(*) FROM categories WHERE is_active = 1) AS categories,
         (SELECT COUNT(*) FROM users WHERE role = 'customer') AS customers,
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM product_supplier) AS supplier_rows`
    ),
    queryOne(
      `SELECT
         COALESCE(SUM(total), 0) AS gross,
         COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END), 0) AS collected,
         COALESCE(SUM(CASE WHEN payment_status = 'refunded' THEN total ELSE 0 END), 0) AS refunded
       FROM orders
        WHERE status <> 'cancelled'`
    ),
    queryOne(
      `SELECT
         COALESCE(SUM(CASE WHEN payment_status IN ('paid','refunded') THEN total ELSE 0 END), 0) AS revenue,
         COALESCE(SUM(CASE WHEN payment_status IN ('paid','refunded') THEN supplier_cost_total ELSE 0 END), 0) AS supplier_costs,
         COALESCE(SUM(CASE WHEN payment_status IN ('paid','refunded') THEN shipping_cost_total ELSE 0 END), 0) AS shipping_costs,
         COALESCE(SUM(CASE WHEN payment_status IN ('paid','refunded') THEN payment_fee ELSE 0 END), 0) AS payment_fees,
         COALESCE(SUM(CASE WHEN payment_status IN ('paid','refunded') THEN advertising_cost + other_costs ELSE 0 END), 0) AS other_costs,
         COALESCE(AVG(CASE WHEN payment_status = 'paid' THEN total ELSE NULL END), 0) AS aov
       FROM orders
       WHERE status <> 'cancelled'`
    ),
    queryOne(
      `SELECT
         SUM(payment_status = 'paid') AS paid,
         SUM(payment_status = 'pending') AS pending,
         SUM(status = 'delivered') AS delivered,
         SUM(payment_status = 'refunded') AS refunds
       FROM orders`
    ),
    query(
      `SELECT status, COUNT(*) AS n FROM orders GROUP BY status`
    ),
    query(
      `SELECT o.order_number, o.status, o.payment_status, o.total, o.currency, o.email,
              o.shipping_city, o.shipping_country, o.placed_at,
              (SELECT COUNT(*) FROM order_items oi WHERE oi.order_id = o.id) AS item_count
         FROM orders o
        ORDER BY o.placed_at DESC, o.id DESC
        LIMIT 8`
    ),
    query(
      `SELECT p.id, p.name, p.slug, p.stock, p.price,
              (SELECT pi.url FROM product_images pi
                WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.position ASC LIMIT 1) AS image
         FROM products p
        WHERE p.is_active = 1 AND p.stock <= 3
        ORDER BY p.stock ASC, p.id ASC
        LIMIT 8`
    ),
    Promise.resolve(sync.isRunning()),
    query(
      `SELECT oi.name, SUM(oi.quantity) AS units,
              SUM(oi.line_total) AS revenue,
              SUM(oi.line_total - oi.unit_supplier_cost * oi.quantity - oi.shipping_cost - oi.payment_fee) AS profit
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status IN ('paid','refunded') AND o.status <> 'cancelled'
        GROUP BY oi.name
        ORDER BY units DESC
        LIMIT 5`
    ),
    query(
      `SELECT oi.name, SUM(oi.line_total - oi.unit_supplier_cost * oi.quantity - oi.shipping_cost - oi.payment_fee) AS profit
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
        WHERE o.payment_status IN ('paid','refunded') AND o.status <> 'cancelled'
        GROUP BY oi.name
        ORDER BY profit DESC
        LIMIT 5`
    ),
    query(
      `SELECT DATE(o.placed_at) AS d,
              SUM(o.total) AS revenue,
              SUM(o.total - o.supplier_cost_total - o.shipping_cost_total - o.payment_fee - o.advertising_cost - o.other_costs) AS profit
         FROM orders o
        WHERE o.payment_status IN ('paid','refunded') AND o.status <> 'cancelled'
        GROUP BY DATE(o.placed_at)
        ORDER BY d DESC
        LIMIT 30`
    ),
  ]);

  const counts = Object.fromEntries(statusRows(statusCounts));
  const topCategories = [...tree]
    .sort((a, b) => b.productCount - a.productCount)
    .slice(0, 8);

  res.json({
    ok: true,
    overview: {
      catalogue: {
        activeProducts: Number(totals.active_products),
        archivedProducts: Number(totals.archived_products),
        variants: Number(totals.variants),
        categories: Number(totals.categories),
        supplierRows: Number(totals.supplier_rows),
      },
      customers: Number(totals.customers),
      orders: {
        total: Number(totals.orders),
        open: Object.entries(counts)
          .filter(([s]) => isOpen(s))
          .reduce((n, [, v]) => n + v, 0),
        cancelled: counts.cancelled || 0,
        delivered: counts.delivered || 0,
        byStatus: counts,
      },
      revenue: {
        gross: decimal(revenue.gross),
        collected: decimal(revenue.collected),
        refunded: decimal(revenue.refunded),
      },
      financials: (() => {
        const revenueTotal = decimal(financials.revenue) || 0;
        const supplierCosts = decimal(financials.supplier_costs) || 0;
        const shippingCosts = decimal(financials.shipping_costs) || 0;
        const paymentFees = decimal(financials.payment_fees) || 0;
        const otherCosts = decimal(financials.other_costs) || 0;
        const grossMargin = revenueTotal - supplierCosts;
        const operatingMargin = grossMargin - shippingCosts - paymentFees;
        return {
          revenue: revenueTotal,
          supplierCosts,
          shippingCosts,
          paymentFees,
          otherCosts,
          grossMargin,
          operatingMargin,
          estimatedNetProfit: operatingMargin - otherCosts,
          averageOrderValue: decimal(financials.aov) || 0,
          paidOrders: Number(orderCounts.paid || 0),
          pendingOrders: Number(orderCounts.pending || 0),
          deliveredOrders: Number(orderCounts.delivered || 0),
          refunds: Number(orderCounts.refunds || 0),
          bestSelling: bestSelling.map((p) => ({
            name: p.name,
            units: Number(p.units),
            revenue: decimal(p.revenue) || 0,
            profit: decimal(p.profit) || 0,
          })),
          mostProfitable: mostProfitable.map((p) => ({
            name: p.name,
            profit: decimal(p.profit) || 0,
          })),
          byDate: byDate.map((d) => ({
            date: d.d,
            revenue: decimal(d.revenue) || 0,
            profit: decimal(d.profit) || 0,
          })),
        };
      })(),
      syncRunning: cj,
      lowStock: lowStock.map((p) => ({
        id: String(p.id),
        name: p.name,
        slug: p.slug,
        stock: Number(p.stock),
        price: decimal(p.price),
        image: p.image,
      })),
      topCategories: topCategories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        productCount: c.productCount,
      })),
      recentOrders: recent.map((o) => ({
        orderNumber: o.order_number,
        status: o.status,
        paymentStatus: o.payment_status,
        total: decimal(o.total),
        currency: o.currency,
        email: o.email,
        itemCount: Number(o.item_count),
        destination: `${o.shipping_city || ''}, ${o.shipping_country || ''}`.trim(),
        placedAt: o.placed_at,
        isOpen: isOpen(o.status),
      })),
    },
  });
}

/** `status -> count` from a GROUP BY result. */
function statusRows(rows) {
  return rows.map((r) => [r.status, Number(r.n)]);
}

/**
 * GET /api/admin/products — catalogue management list.
 *
 * Includes supplier cost and margin, which is the whole point of the admin view
 * and is impossible to derive from public data by design.
 */
async function listProducts(req, res) {
  const { q, category, includeArchived, lowStock, page = 1, pageSize = 25 } = req.query;

  const where = [];
  const args = [];

  if (!includeArchived) where.push('p.is_active = 1');
  if (q) {
    where.push('(p.name LIKE ? OR p.sku LIKE ?)');
    const like = `%${String(q).trim()}%`;
    args.push(like, like);
  }
  if (category) {
    where.push('c.slug = ?');
    args.push(String(category));
  }
  if (lowStock) where.push('p.stock <= 3');

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const size = Math.min(Math.max(1, Number(pageSize) || 25), 100);
  const current = Math.max(1, Number(page) || 1);

  const countRow = await queryOne(
    `SELECT COUNT(*) AS total FROM products p LEFT JOIN categories c ON c.id = p.category_id ${whereSql}`,
    args
  );

  const rows = await query(
    `SELECT p.id, p.name, p.slug, p.sku, p.price, p.stock, p.status, p.is_active,
            p.published_at, c.name AS category_name, c.slug AS category_slug,
            ps.supplier, ps.supplier_product_id, ps.supplier_stock,
            ps.cost_price, ps.shipping_cost, ps.last_synced_at,
            (SELECT pi.url FROM product_images pi
              WHERE pi.product_id = p.id ORDER BY pi.is_primary DESC, pi.position ASC LIMIT 1) AS image
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_supplier ps ON ps.product_id = p.id AND ps.supplier = 'cj'
       ${whereSql}
       ORDER BY p.id DESC
       LIMIT ? OFFSET ?`,
    [...args, size, (current - 1) * size]
  );

  const total = Number(countRow.total);

  res.json({
    ok: true,
    items: rows.map((p) => {
      const sell = decimal(p.price);
      const cost = p.cost_price === null ? null : decimal(p.cost_price);
      return {
        id: String(p.id),
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        image: p.image,
        price: sell,
        stock: Number(p.stock),
        status: p.status,
        isActive: Boolean(p.is_active),
        category: p.category_slug ? { slug: p.category_slug, name: p.category_name } : null,
        supplier: p.supplier_product_id
          ? {
              supplier: p.supplier,
              productId: p.supplier_product_id,
              stock: Number(p.supplier_stock),
              costPrice: cost,
              shippingCost: decimal(p.shipping_cost),
              lastSyncedAt: p.last_synced_at,
            }
          : null,
        // Gross margin on the sell price. Null when there is no supplier cost.
        marginAmount: cost !== null ? Math.round((sell - cost) * 100) / 100 : null,
        marginPercent:
          cost !== null && sell > 0
            ? Math.round(((sell - cost) / sell) * 1000) / 10
            : null,
      };
    }),
    page: current,
    pageSize: size,
    total,
    totalPages: Math.max(1, Math.ceil(total / size)),
  });
}

/** GET /api/admin/products/:id — one product with its supplier detail. */
async function getProduct(req, res) {
  const row = await queryOne(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = ? LIMIT 1`,
    [String(req.params.id)]
  );
  if (!row) throw HttpError.notFound('Product not found');

  const [supplier, images, variants] = await Promise.all([
    queryOne(
      `SELECT supplier, supplier_product_id, supplier_sku, supplier_name, supplier_url,
              cost_price, shipping_cost, supplier_stock, last_synced_at, variants_synced_at
         FROM product_supplier WHERE product_id = ? AND supplier = 'cj' LIMIT 1`,
      [row.id]
    ),
    query('SELECT url, alt, position, is_primary FROM product_images WHERE product_id = ? ORDER BY position', [row.id]),
    query(
      'SELECT id, name, option_type, option_value, sku, price, stock, supplier_variant_id FROM product_variants WHERE product_id = ? ORDER BY position, id',
      [row.id]
    ),
  ]);

  res.json({
    ok: true,
    product: {
      id: String(row.id),
      name: row.name,
      slug: row.slug,
      sku: row.sku,
      brand: row.brand,
      shortDescription: row.short_description,
      description: row.description,
      price: decimal(row.price),
      compareAtPrice: row.compare_at_price === null ? null : decimal(row.compare_at_price),
      stock: Number(row.stock),
      status: row.status,
      isActive: Boolean(row.is_active),
      publishedAt: row.published_at,
      category: row.category_slug ? { slug: row.category_slug, name: row.category_name } : null,
      images: images.map((i) => ({ url: i.url, alt: i.alt, isPrimary: Boolean(i.is_primary) })),
      variants: variants.map((v) => ({
        id: String(v.id),
        name: v.name,
        optionType: v.option_type,
        optionValue: v.option_value,
        sku: v.sku,
        price: v.price === null ? null : decimal(v.price),
        stock: Number(v.stock),
        supplierVariantId: v.supplier_variant_id,
      })),
      supplier: supplier
        ? {
            supplier: supplier.supplier,
            productId: supplier.supplier_product_id,
            sku: supplier.supplier_sku,
            name: supplier.supplier_name,
            url: supplier.supplier_url,
            costPrice: decimal(supplier.cost_price),
            shippingCost: decimal(supplier.shipping_cost),
            supplierStock: Number(supplier.supplier_stock),
            lastSyncedAt: supplier.last_synced_at,
            variantsSyncedAt: supplier.variants_synced_at,
          }
        : null,
    },
  });
}

/** GET /api/admin/settings/cj — non-secret integration status. */
async function cjSettings(req, res) {
  const status = await tokenStore.status();
  res.json({ ok: true, settings: status });
}

/**
 * PATCH /api/admin/products/:id — admin price control.
 *
 * Body: { price: number }
 * The selling price is ZAVORA's decision; CJ's cost is never auto-applied.
 */
async function updatePrice(req, res) {
  const price = Number(req.body?.price);
  if (!Number.isFinite(price) || price < 0 || price > 1000000) {
    throw HttpError.badRequest('Enter a valid selling price');
  }
  const result = await execute('UPDATE products SET price = ? WHERE id = ?', [
    price.toFixed(2),
    String(req.params.id),
  ]);
  if (!result.affectedRows) throw HttpError.notFound('Product not found');
  const row = await queryOne('SELECT id, price FROM products WHERE id = ?', [String(req.params.id)]);
  res.json({ ok: true, price: decimal(row.price) });
}

module.exports = { overview, listProducts, getProduct, cjSettings, updatePrice };
