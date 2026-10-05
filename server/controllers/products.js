/**
 * Public catalogue endpoints.
 *
 * Every response here goes through lib/catalog.js, which builds the SQL with an
 * explicit column list and never touches product_supplier.
 */

const catalog = require('../lib/catalog');
const { HttpError } = require('../middleware/error');

/** GET /api/products — list with filters/sort/pagination. */
async function list(req, res) {
  const result = await catalog.listProducts(req.query);
  res.json({ ok: true, ...result });
}

/** GET /api/products/trending */
async function trending(req, res) {
  const items = await catalog.getTrendingProducts(req.query.limit);
  res.json({ ok: true, items });
}

/** GET /api/products/search — typeahead, name-only. */
async function search(req, res) {
  const items = await catalog.searchSuggestions(req.query.q, req.query.limit);
  res.json({ ok: true, items });
}

/**
 * GET /api/products/:slug
 *
 * Registered after the literal routes above so "trending" and "search" are not
 * captured as a slug.
 */
async function detail(req, res) {
  const product = await catalog.getProductBySlug(req.params.slug);
  if (!product) throw HttpError.notFound('Product not found');
  res.json({ ok: true, product });
}

/** GET /api/products/:slug/related */
async function related(req, res) {
  const items = await catalog.getRelatedProducts(req.params.slug, req.query.limit);
  res.json({ ok: true, items });
}

/** GET /api/products/:slug/reviews */
async function reviews(req, res) {
  const product = await catalog.getProductBySlug(req.params.slug, { includeInactive: true });
  if (!product) throw HttpError.notFound('Product not found');
  const items = await catalog.listProductReviews(req.params.slug, req.query.limit);
  res.json({ ok: true, items });
}

module.exports = { list, trending, search, detail, related, reviews };
