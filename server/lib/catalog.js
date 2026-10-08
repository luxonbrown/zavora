/**
 * Catalogue reads.
 *
 * This module is the ONLY place public product SQL is built, which is what makes
 * the supplier boundary enforceable rather than aspirational:
 *
 *   - The column list below is explicit and hardcoded. There is no `SELECT *`,
 *     so adding a cost column to `products` later cannot silently leak.
 *   - `product_supplier` is never referenced by any function in this file.
 *   - Sort keys are mapped through an allowlist, never interpolated from input.
 *
 * Everything uses `execute`/parameter binding; no user value is concatenated
 * into SQL text except whitelisted identifiers.
 */

const { query, queryOne } = require('../database/pool');
const config = require('../config');
const { decimal } = require('./money');

/** The complete set of product fields allowed in a public response. */
const PRODUCT_FIELDS = `
  p.id,
  p.slug,
  p.name,
  p.sku,
  p.brand,
  p.short_description,
  p.description,
  p.price,
  p.compare_at_price,
  p.rating,
  p.review_count,
  p.stock,
  p.badge,
  p.specifications,
  p.status,
  p.published_at,
  c.slug AS category_slug,
  c.name AS category_name,
  (SELECT pi.url FROM product_images pi
     WHERE pi.product_id = p.id
     ORDER BY pi.is_primary DESC, pi.position ASC LIMIT 1) AS image_url
`;

const SORTABLE = {
  // "Featured" is newest-first for now. There is no hand-curated flag column,
  // so this stays honest rather than sorting on a field that does not exist.
  featured: 'p.published_at DESC, p.id DESC',
  newest: 'p.published_at DESC, p.id DESC',
  'price-asc': 'p.price ASC, p.id ASC',
  'price-desc': 'p.price DESC, p.id DESC',
  rating: 'p.rating DESC, p.review_count DESC, p.id DESC',
  popular: 'p.review_count DESC, p.rating DESC, p.id DESC',
  // Explicit tie-breakers everywhere: stable pagination needs a total order, or
  // rows can repeat or vanish across pages when two products share a sort value.
  name: 'p.name ASC, p.id ASC',
};

const DEFAULT_SORT = 'featured';
const MAX_PAGE_SIZE = 48;

/**
 * `specifications` is stored as a JSON array of [label, value] pairs. A bad or
 * missing value must not break the product page, so parsing never throws.
 */
function parseSpecifications(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((pair) => Array.isArray(pair) && pair.length >= 2);
  } catch {
    return [];
  }
}

/** Map a DB product row to the public API shape (prices as numbers). */
function mapProduct(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    sku: row.sku,
    brand: row.brand,
    shortDescription: row.short_description,
    description: row.description,
    price: decimal(row.price),
    compareAtPrice: row.compare_at_price === null ? null : decimal(row.compare_at_price),
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    stock: Number(row.stock),
    inStock: Number(row.stock) > 0,
    badge: row.badge ?? null,
    specifications: parseSpecifications(row.specifications),
    // The catalogue sorts by published_at; the UI's mock shape calls it createdAt.
    createdAt: row.published_at,
    category: { slug: row.category_slug, name: row.category_name },
    image: row.image_url,
  };
}

function clampPageSize(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return 12;
  return Math.min(Math.floor(n), MAX_PAGE_SIZE);
}

/**
 * Every id in the subtree rooted at `slug`, inclusive.
 *
 * The catalogue is a three-level tree imported from CJ, so filtering on a
 * top-level category ("Women's Clothing") has to include everything beneath it
 * ("Tops & Sets" -> "Hoodies"), not just products attached at that exact node.
 * A recursive CTE resolves the subtree in one round trip.
 */
async function categorySubtreeIds(slug) {
  // No LIMIT in the anchor member: MariaDB rejects it inside a recursive CTE
  // (ER_PARSE_ERROR). `slug` carries a UNIQUE key, so the anchor matches at
  // most one row anyway.
  const rows = await query(
    `WITH RECURSIVE subtree AS (
       SELECT id FROM categories WHERE slug = ?
       UNION ALL
       SELECT c.id FROM categories c JOIN subtree s ON c.parent_id = s.id
     )
     SELECT id FROM subtree`,
    [String(slug)]
  );
  return rows.map((r) => r.id);
}

/**
 * List products with filtering, sorting and pagination.
 * Returns { items, page, pageSize, total, totalPages, hasMore }.
 */
async function listProducts(params = {}) {
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = clampPageSize(params.pageSize);
  const offset = (page - 1) * pageSize;

  const where = ["p.status = 'active'", 'p.is_active = 1'];
  const args = [];

  if (params.category) {
    const ids = await categorySubtreeIds(params.category);
    if (!ids.length) {
      // Unknown category: return an empty page rather than the whole catalogue.
      return {
        items: [], page, pageSize, total: 0, totalPages: 1, hasMore: false,
      };
    }
    where.push(`p.category_id IN (${ids.map(() => '?').join(',')})`);
    args.push(...ids);
  }

  if (params.minPrice !== undefined && params.minPrice !== '') {
    where.push('p.price >= ?');
    args.push(String(params.minPrice));
  }
  if (params.maxPrice !== undefined && params.maxPrice !== '') {
    where.push('p.price <= ?');
    args.push(String(params.maxPrice));
  }
  if (params.inStock) {
    where.push('p.stock > 0');
  }
  if (params.minRating) {
    where.push('p.rating >= ?');
    args.push(Number(params.minRating));
  }

  const q = params.q ? String(params.q).trim() : '';
  let usedFulltext = false;
  let matchArgIndex = -1;
  const isPostgres = (config.db.driver || 'mysql').toLowerCase() === 'postgres';
  if (q) {
    if (isPostgres) {
      // Postgres has no MATCH ... AGAINST. The GIN tsvector + pg_trgm indexes
      // in database/postgres/schema.sql back this ILIKE path; no LIKE retry
      // below is needed because this IS the fallback.
      where.push('(p.name ILIKE ? OR p.short_description ILIKE ? OR p.description ILIKE ?)');
      const like = `%${q}%`;
      args.push(like, like, like);
    } else {
      // Boolean-mode prefix search, which is what the ft_products_search index is
      // for. Falls back to LIKE when it matches nothing (below).
      where.push('MATCH(p.name, p.short_description, p.description) AGAINST (? IN BOOLEAN MODE)');
      matchArgIndex = args.length;
      args.push(booleanQuery(q));
      usedFulltext = true;
    }
  }

  const sortKey = SORTABLE[params.sort] ? params.sort : DEFAULT_SORT;
  const orderBy = SORTABLE[sortKey];
  let whereSql = where.join(' AND ');

  let countRows = await query(
    `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${whereSql}`,
    args
  );
  let total = Number(countRows[0].total);

  if (usedFulltext && total === 0) {
    // "shoe" should find "Nimbus Running Shoes" even though the token itself is
    // not indexed as a whole word. Retry as a substring match.
    //
    // The MATCH condition is removed from both `where` AND `args`: leaving its
    // bound value behind would make the placeholder count disagree with the
    // parameter count and the driver would reject the statement.
    where.pop();
    args.splice(matchArgIndex, 1);
    where.push('(p.name LIKE ? OR p.short_description LIKE ?)');
    const like = `%${q}%`;
    args.push(like, like);
    const retry = await query(
      `SELECT COUNT(*) AS total
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
        WHERE ${where.join(' AND ')}`,
      args
    );
    total = Number(retry[0].total);
    // Re-derive the clause for the rows query below, which runs after this
    // fallback has rewritten `where`.
    whereSql = where.join(' AND ');
  }

  const rows = await query(
    `SELECT ${PRODUCT_FIELDS}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE ${whereSql}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
    // mysql2 requires LIMIT/OFFSET as numbers, not strings.
    [...args.map((a) => (typeof a === 'number' ? a : String(a))), pageSize, offset]
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    items: rows.map(mapProduct),
    page,
    pageSize,
    total,
    totalPages,
    hasMore: page < totalPages,
  };
}

/** Build a boolean-mode search string: every token prefix-matched, last too. */
function booleanQuery(text) {
  const tokens = text
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[+\-><()~*"@]/g, '').trim())
    .filter(Boolean);
  if (!tokens.length) return '';
  return tokens.map((t, i) => (i === tokens.length - 1 ? `${t}*` : `+${t}*`)).join(' ');
}

/** One product with its images, variants and category. Public fields only. */
async function getProductBySlug(slug, { includeInactive = false } = {}) {
  const row = await queryOne(
    `SELECT ${PRODUCT_FIELDS}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.slug = ? ${includeInactive ? '' : "AND p.status = 'active' AND p.is_active = 1"}
      LIMIT 1`,
    [String(slug)]
  );
  if (!row) return null;

  const images = await query(
    `SELECT url, alt, position, is_primary
       FROM product_images
      WHERE product_id = ?
      ORDER BY is_primary DESC, position ASC`,
    [row.id]
  );

  const variants = await query(
    `SELECT id, name, option_type, option_value, sku, price, stock, position
       FROM product_variants
      WHERE product_id = ?
      ORDER BY position ASC, id ASC`,
    [row.id]
  );

  const base = mapProduct(row);
  return {
    ...base,
    images: images.map((i) => ({
      url: i.url,
      alt: i.alt,
      position: Number(i.position),
      isPrimary: Boolean(i.is_primary),
    })),
    variants: variants.map((v) => ({
      id: String(v.id),
      name: v.name,
      optionType: v.option_type,
      optionValue: v.option_value,
      sku: v.sku,
      // null means "same price as the product", not free.
      price: v.price === null ? base.price : decimal(v.price),
      stock: Number(v.stock),
      position: Number(v.position),
    })),
    colors: variants
      .filter((v) => v.option_type === 'color')
      .map((v) => ({ name: v.name, value: v.option_value })),
    sizes: variants.filter((v) => v.option_type === 'size').map((v) => v.name),
  };
}

/** Other products in the same category, excluding the one given. */
async function getRelatedProducts(slug, limit = 4) {
  const rows = await query(
    `SELECT ${PRODUCT_FIELDS}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active'
        AND p.is_active = 1
        AND p.slug <> ?
        AND p.category_id = (SELECT category_id FROM products WHERE slug = ? LIMIT 1)
      ORDER BY p.rating DESC, p.review_count DESC, p.id ASC
      LIMIT ?`,
    [String(slug), String(slug), Math.min(Number(limit) || 4, 12)]
  );
  return rows.map(mapProduct);
}

/** Highest-rated active products, for the homepage trending rail. */
async function getTrendingProducts(limit = 8) {
  const rows = await query(
    `SELECT ${PRODUCT_FIELDS}
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.status = 'active' AND p.is_active = 1
      ORDER BY p.rating DESC, p.review_count DESC, p.id ASC
      LIMIT ?`,
    [Math.min(Number(limit) || 8, 24)]
  );
  return rows.map(mapProduct);
}

/** Quick typeahead over names only. */
async function searchSuggestions(q, limit = 6) {
  const term = String(q || '').trim();
  if (!term) return [];
  const like = `%${term}%`;
  const rows = await query(
    `SELECT p.slug, p.name, p.price
       FROM products p
      WHERE p.status = 'active' AND p.is_active = 1 AND p.name LIKE ?
      ORDER BY p.rating DESC, p.id ASC
      LIMIT ?`,
    [like, Math.min(Number(limit) || 6, 10)]
  );
  return rows.map((r) => ({ slug: r.slug, name: r.name, price: decimal(r.price) }));
}

/**
 * Category tree with rollup product counts.
 *
 * Products are attached to the most specific (leaf) level, so a parent category
 * has no products of its own. Counting only direct children would show every
 * parent as zero, which makes the navigation useless — so counts are summed up
 * the tree in JS. Two queries regardless of depth, rather than a recursive
 * aggregation per node.
 *
 * `maxDepth` bounds how deep the nested `children` arrays go. The full CJ tree
 * is 561 nodes and serialising all of it measured 354 KB, which is far too much
 * to send on every homepage and shop render. Navigation therefore ships the top
 * two levels and records how many leaves were pruned; `/categories/:slug` serves
 * the deeper levels on demand.
 *
 * Returns `{ tree, flat, totalNodes }`.
 */
async function listCategoryTree({ maxDepth = 2 } = {}) {
  const [nodes, counts] = await Promise.all([
    query(
      `SELECT id, parent_id, name, slug, tagline, position
         FROM categories
        WHERE is_active = 1
        ORDER BY position ASC, name ASC`
    ),
    query(
      `SELECT category_id AS id, COUNT(*) AS n
         FROM products
        WHERE status = 'active' AND is_active = 1 AND category_id IS NOT NULL
        GROUP BY category_id`
    ),
  ]);

  const directCount = new Map(counts.map((c) => [c.id, Number(c.n)]));
  const byId = new Map();
  for (const node of nodes) {
    byId.set(node.id, {
      id: String(node.id),
      parentId: node.parent_id === null ? null : String(node.parent_id),
      slug: node.slug,
      name: node.name,
      tagline: node.tagline,
      position: Number(node.position),
      directCount: 0,
      productCount: 0, // rolled up below
      children: [],
    });
  }

  const roots = [];
  for (const node of nodes) {
    const built = byId.get(node.id);
    built.directCount = directCount.get(node.id) || 0;
    built.productCount = built.directCount;
    const parent = node.parent_id === null ? null : byId.get(node.parent_id);
    if (parent) parent.children.push(built);
    else roots.push(built);
  }

  // Roll counts up: a node's count becomes its own plus every descendant's.
  const rollUp = (node) => {
    let total = node.directCount;
    for (const child of node.children) total += rollUp(child);
    node.productCount = total;
    return total;
  };
  roots.forEach(rollUp);

  // Flat list, for lookups. Pruned to branches that actually stock something.
  const flat = [];
  const collect = (list, depth) => {
    for (const n of list) {
      if (n.productCount > 0) flat.push({ ...n, depth });
      collect(n.children, depth + 1);
    }
  };
  collect(roots, 0);

  let totalNodes = 0;

  /**
   * Drop empty branches (nothing to show) and cut the tree at `maxDepth`,
   * replacing anything deeper with a count so the UI can offer "view all".
   */
  const shape = (list, depth) => {
    totalNodes += list.length;
    return list
      .filter((n) => n.productCount > 0)
      .map((n) => {
        if (depth + 1 >= maxDepth) {
          // Count the leaves this node is standing in for.
          let hidden = 0;
          const tally = (x) => {
            hidden += 1;
            x.children.forEach(tally);
          };
          tally(n);
          return {
            id: n.id,
            slug: n.slug,
            name: n.name,
            tagline: n.tagline,
            productCount: n.productCount,
            leafCount: hidden,
            children: [],
          };
        }
        return {
          id: n.id,
          slug: n.slug,
          name: n.name,
          tagline: n.tagline,
          productCount: n.productCount,
          children: shape(n.children, depth + 1),
        };
      });
  };
  const tree = shape(roots, 0);

  return { tree, flat, totalNodes };
}

/** Flat list of active categories with rollup product counts. */
async function listCategories() {
  const { flat } = await listCategoryTree({ maxDepth: 99 });
  return flat.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    tagline: c.tagline,
    depth: c.depth,
    parentId: c.parentId,
    productCount: c.productCount,
    directCount: c.directCount,
  }));
}

/**
 * One category with its immediate children, for the shop sidebar when a
 * customer drills into a branch.
 *
 * Built from the rolled-up `flat` list rather than a fresh query, because a
 * middle-level category has NO products of its own — its children must show the
 * ROLLUP count, or every branch reads as empty. Ids in `flat` are strings and in
 * the raw table they are numbers, so everything is compared as a string.
 */
async function getCategoryBranch(slug) {
  const { flat } = await listCategoryTree({ maxDepth: 99 });
  const node = flat.find((c) => c.slug === slug);
  if (!node) return null;

  const children = flat
    .filter((c) => c.parentId !== null && c.parentId === node.id)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      productCount: c.productCount,
    }));

  return {
    id: node.id,
    slug: node.slug,
    name: node.name,
    tagline: node.tagline,
    productCount: node.productCount,
    children,
  };
}

async function getCategoryBySlug(slug) {
  const row = await queryOne(
    'SELECT id, slug, name, tagline FROM categories WHERE slug = ? AND is_active = 1 LIMIT 1',
    [String(slug)]
  );
  if (!row) return null;
  return { id: String(row.id), slug: row.slug, name: row.name, tagline: row.tagline };
}

/** Published reviews for a product, newest first. */
async function listProductReviews(slug, limit = 20) {
  const rows = await query(
    `SELECT r.rating, r.title, r.body, r.author_name, r.country, r.is_verified, r.created_at
       FROM reviews r
       JOIN products p ON p.id = r.product_id
      WHERE p.slug = ?
      ORDER BY r.created_at DESC, r.id DESC
      LIMIT ?`,
    [String(slug), Math.min(Number(limit) || 20, 100)]
  );
  return rows.map((r) => ({
    rating: Number(r.rating),
    title: r.title,
    body: r.body,
    authorName: r.author_name,
    country: r.country,
    isVerified: Boolean(r.is_verified),
    createdAt: r.created_at,
  }));
}

/**
 * Resolve products for a cart/checkout payload. This is the pricing authority:
 * it returns current stock and price from the database, so a client-supplied
 * price can never influence a total.
 */
async function resolvePurchasables(lines) {
  if (!Array.isArray(lines) || !lines.length) return [];

  const productIds = [...new Set(lines.map((l) => String(l.productId)))];
  const variantIds = [...new Set(lines.map((l) => l.variantId).filter(Boolean).map(String))];

  const products = await query(
    `SELECT ${PRODUCT_FIELDS} FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id IN (${productIds.map(() => '?').join(',')})
        AND p.status = 'active' AND p.is_active = 1`,
    productIds
  );

  let variants = [];
  if (variantIds.length) {
    variants = await query(
      `SELECT id, product_id, name, price, stock
         FROM product_variants
        WHERE id IN (${variantIds.map(() => '?').join(',')})`,
      variantIds
    );
  }

  const productById = new Map(products.map((p) => [String(p.id), p]));
  const variantById = new Map(variants.map((v) => [String(v.id), v]));

  return lines.map((line) => {
    // Availability is decided by the WHERE clause above, which is index-friendly
    // and authoritative. It must NOT be re-derived in JS from PRODUCT_FIELDS:
    // that list is the public response shape and carries no is_active column,
    // so a check like `!row.is_active` would be `!undefined` and reject
    // everything.
    const product = productById.get(String(line.productId));
    if (!product) {
      return { line, available: false, reason: 'PRODUCT_UNAVAILABLE' };
    }

    let variant = null;
    if (line.variantId) {
      variant = variantById.get(String(line.variantId));
      // A variant belonging to a different product is a client error, not a
      // missing product, and must never silently resolve to the base variant.
      if (!variant || String(variant.product_id) !== String(product.id)) {
        return { line, available: false, reason: 'VARIANT_UNAVAILABLE' };
      }
    }

    const unitCents =
      variant && variant.price !== null ? Number(variant.price) * 100 : Number(product.price) * 100;

    return {
      line,
      product: mapProduct(product),
      variant: variant
        ? { id: String(variant.id), name: variant.name, stock: Number(variant.stock) }
        : null,
      unitCents: Math.round(unitCents),
      availableStock: variant ? Number(variant.stock) : Number(product.stock),
      available: true,
    };
  });
}

/**
 * Decrement stock atomically, failing rather than overselling.
 *
 * Must be called with a transaction `conn`: the `AND stock >= ?` guard only
 * protects against a lost update while the surrounding transaction holds its
 * locks. Note that a mysql2 *connection* returns `[result, fields]` from
 * execute() whereas the pool helper in database/pool.js returns just the
 * header — this function therefore always uses the connection form and
 * destructures the tuple, so it must not be pointed at the pool helper.
 */
async function decrementStock({ productId, variantId, quantity, conn }) {
  if (!conn) throw new Error('decrementStock requires a transaction connection');
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) throw new Error(`Invalid quantity: ${quantity}`);

  if (variantId) {
    const [res] = await conn.execute(
      'UPDATE product_variants SET stock = stock - ? WHERE id = ? AND stock >= ?',
      [qty, variantId, qty]
    );
    return res.affectedRows === 1;
  }
  const [res] = await conn.execute(
    'UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?',
    [qty, productId, qty]
  );
  return res.affectedRows === 1;
}

module.exports = {
  PRODUCT_FIELDS,
  mapProduct,
  listProducts,
  getProductBySlug,
  getRelatedProducts,
  getTrendingProducts,
  searchSuggestions,
  listCategories,
  listCategoryTree,
  getCategoryBranch,
  categorySubtreeIds,
  getCategoryBySlug,
  listProductReviews,
  resolvePurchasables,
  decrementStock,
};
