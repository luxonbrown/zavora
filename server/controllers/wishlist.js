/**
 * Wishlist. Requires a session; the schema keys on user_id, so a guest wishlist
 * is intentionally not supported (the client keeps one in localStorage until
 * sign-in, then syncs).
 */

const { query, execute } = require('../database/pool');
const { HttpError } = require('../middleware/error');
const { decimal } = require('../lib/money');

/** GET /api/wishlist */
async function list(req, res) {
  const rows = await query(
    `SELECT p.id, p.slug, p.name, p.price, p.compare_at_price, p.rating, p.review_count, p.stock,
            w.created_at AS added_at,
            (SELECT pi.url FROM product_images pi
               WHERE pi.product_id = p.id
               ORDER BY pi.is_primary DESC, pi.position ASC LIMIT 1) AS image_url
       FROM wishlist w
       JOIN products p ON p.id = w.product_id
      WHERE w.user_id = ? AND p.status = 'active' AND p.is_active = 1
      ORDER BY w.created_at DESC, w.id DESC`,
    [req.user.id]
  );

  res.json({
    ok: true,
    items: rows.map((r) => ({
      id: String(r.id),
      slug: r.slug,
      name: r.name,
      price: decimal(r.price),
      compareAtPrice: r.compare_at_price === null ? null : decimal(r.compare_at_price),
      rating: Number(r.rating),
      reviewCount: Number(r.review_count),
      inStock: Number(r.stock) > 0,
      image: r.image_url,
      addedAt: r.added_at,
    })),
  });
}

/** POST /api/wishlist — toggle. Returns the resulting state. */
async function toggle(req, res) {
  const productId = String((req.body || {}).productId || '');
  if (!productId) throw HttpError.badRequest('productId is required');

  const exists = await query(
    'SELECT id FROM wishlist WHERE user_id = ? AND product_id = ? LIMIT 1',
    [req.user.id, productId]
  );

  if (exists.length) {
    await execute('DELETE FROM wishlist WHERE id = ?', [exists[0].id]);
    res.json({ ok: true, inWishlist: false });
    return;
  }

  // An unknown product must 400 rather than insert a dangling row.
  const product = await query('SELECT id FROM products WHERE id = ? AND is_active = 1 LIMIT 1', [
    productId,
  ]);
  if (!product.length) throw HttpError.notFound('Product not found');

  await execute('INSERT INTO wishlist (user_id, product_id) VALUES (?, ?)', [
    req.user.id,
    productId,
  ]);
  res.status(201).json({ ok: true, inWishlist: true });
}

/** DELETE /api/wishlist/:productId */
async function remove(req, res) {
  await execute('DELETE FROM wishlist WHERE user_id = ? AND product_id = ?', [
    req.user.id,
    String(req.params.productId),
  ]);
  res.json({ ok: true });
}

module.exports = { list, toggle, remove };
