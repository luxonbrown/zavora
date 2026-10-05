/**
 * Categories endpoints.
 *
 * `GET /api/categories` returns the navigation shape: the top two levels with
 * rollup counts. The full CJ tree is 561 nodes and serialising all of it
 * measured 354 KB, which is too much to send on every homepage render. Deeper
 * levels are served by `GET /api/categories/:slug`.
 */

const catalog = require('../lib/catalog');
const { HttpError } = require('../middleware/error');

/** GET /api/categories?depth=n — nested levels to include (default 2). */
async function list(req, res) {
  const requested = Number(req.query.depth);
  const maxDepth = Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 5) : 2;
  const { tree, totalNodes } = await catalog.listCategoryTree({ maxDepth });
  res.json({ ok: true, tree, totalNodes, maxDepth });
}

/** GET /api/categories/:slug — the branch, with its immediate children. */
async function detail(req, res) {
  const branch = await catalog.getCategoryBranch(req.params.slug);
  if (!branch) throw HttpError.notFound('Category not found');

  // How many products the whole subtree holds, for the "N items" heading.
  const subtreeIds = await catalog.categorySubtreeIds(req.params.slug);
  res.json({
    ok: true,
    category: { ...branch, subtreeProductCount: branch.productCount, descendantCount: subtreeIds.length },
  });
}

module.exports = { list, detail };