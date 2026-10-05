/**
 * End-to-end API smoke test.
 *
 * Exercises every public and authenticated route against a live server, and
 * asserts the supplier boundary holds (no cost / supplier fields in any
 * response the storefront can see).
 *
 * Usage:  npm test              (boots the API in-process on a free port)
 *         API_BASE=http://host:port node test/smoke.js
 *
 * Each block runs independently so one crash reports its own failure without
 * hiding every block after it. Exits non-zero if anything failed.
 *
 * NOTE: this suite mutates data (it places orders and decrements stock).
 * Re-run `npm run db:seed` before repeating it.
 */

const API = process.env.API_BASE || null; // null => start our own server
let server = null;
let baseUrl = API; // resolved in main()

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${label}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

/** A fetch wrapper that keeps one cookie jar, i.e. one session. */
function makeClient() {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(cookie ? { cookie } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, body: json };
  };
}

/** Recursively search a response for forbidden supplier field names. */
function findSupplierLeak(value, path = '') {
  const forbidden =
    /cost_price|shipping_cost|supplier_id|supplier_variant_id|supplier_sku|supplier_url|supplier_stock|supplier_name|last_synced_at|sync_hash/i;
  const hits = [];
  if (Array.isArray(value)) {
    value.forEach((v, i) => hits.push(...findSupplierLeak(v, `${path}[${i}]`)));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (forbidden.test(k)) hits.push(`${path}.${k}`);
      hits.push(...findSupplierLeak(v, `${path}.${k}`));
    }
  }
  return hits;
}

/** Guarded read: returns null instead of throwing when a lookup failed. */
const productOf = (r) => (r.body && r.body.product ? r.body.product : null);

/**
 * Resolve the products this run will exercise.
 *
 * The suite must not hardcode slugs: the catalogue is supplied by
 * CJdropshipping and changes with every sync, so a hardcoded "Aura Headphones"
 * simply stops existing. Instead, pick fixtures by the SHAPE the test needs.
 *
 * Variant enrichment is bounded (one CJ request per product, 1 req/s), so a
 * freshly imported catalogue may legitimately have no variants at all yet.
 * Fixtures therefore degrade gracefully and the variant-specific assertions are
 * conditional, rather than the whole suite crashing on a null.
 */
let fixtures = null;

async function resolveFixtures(anon) {
  if (fixtures) return fixtures;

  const page = await anon('GET', '/api/products?pageSize=48&sort=rating');
  const items = page.body.items || [];

  let withVariants = null;
  let withVariantsSecond = null;
  for (const item of items) {
    if (withVariants && withVariantsSecond) break;
    const detail = await anon('GET', `/api/products/${item.slug}`);
    const p = detail.body.product;
    if (!p) continue;
    if (withVariants) {
      if (p.variants.length >= 2 && p.id !== withVariants.id) withVariantsSecond = p;
      continue;
    }
    if (p.variants.length >= 2) withVariants = p;
  }

  // Fall back to any product when nothing has variants yet. Fetch its detail
  // so the fixture carries `variants`/`images`, which list items do not have.
  let fallback = withVariants;
  if (!fallback && items[0]) {
    const detail = await anon('GET', `/api/products/${items[0].slug}`);
    fallback = detail.body.product || items[0];
  }

  fixtures = {
    any: items[0],
    withVariants: fallback,
    withVariantsSecond,
    plain: items[0],
    other: items[1] || items[0],
    categorySlug: items[0]?.category.slug,
    /** True only when the catalogue genuinely has multi-variant products. */
    hasVariants: Boolean(withVariants),
  };
  return fixtures;
}

/* ------------------------------------------------------------------ health */
async function healthBlock() {
  const r = await makeClient()('GET', '/api/health');
  check('health returns 200', r.status === 200, `got ${r.status}`);
  check('database is up', r.body && r.body.database === 'up');

  const missing = await makeClient()('GET', '/api/nope');
  check('unknown API route 404s', missing.status === 404, `got ${missing.status}`);
}

/**
 * Expected catalogue size, read from the database rather than hardcoded.
 *
 * The catalogue is no longer a fixed 12 rows: a CJ sync adds real products, so
 * an absolute count would fail the moment the integration runs. The invariants
 * below (pagination covers everything exactly once, category counts sum to the
 * total) are what actually matter and hold at any size.
 */
async function expectedCounts() {
  const { query } = require('../database/pool');
  const [p] = await query("SELECT COUNT(*) n FROM products WHERE status='active' AND is_active=1");
  const [c] = await query(
    `SELECT COUNT(*) n FROM categories c WHERE c.is_active = 1
       AND EXISTS (SELECT 1 FROM products p WHERE p.category_id=c.id AND p.status='active' AND p.is_active=1)`
  );
  return { products: Number(p.n), categoriesWithProducts: Number(c.n) };
}

/* --------------------------------------------------------------- catalogue */
async function catalogueBlock() {
  const anon = makeClient();
  await resolveFixtures(anon);
  const { products: EXPECTED } = await expectedCounts();

  const list = await anon('GET', '/api/products?pageSize=50');
  check('product list 200', list.status === 200, `got ${list.status}`);
  check(
    'list total matches the active product count in the DB',
    list.body.total === EXPECTED,
    `api=${list.body.total} db=${EXPECTED}`
  );
  check('no supplier leak in list', findSupplierLeak(list.body).length === 0, findSupplierLeak(list.body).join(', '));
  check('no password_hash anywhere', !JSON.stringify(list.body).includes('password_hash'));

  const first = list.body.items[0];
  check('item has a numeric price', typeof first.price === 'number');
  check('item has an image url', typeof first.image === 'string' && first.image.length > 0);
  check('item exposes no cost field', first.cost === undefined && first.costPrice === undefined);

  // A synced product must still be safe: its cost lives only in product_supplier.
  const synced = list.body.items.find((i) => i.sku && i.sku.startsWith('CJ-'));
  if (synced) {
    check('synced product price is a number', typeof synced.price === 'number');
    check('synced product leaks no supplier fields', findSupplierLeak(synced).length === 0);
    check('synced product exposes no supplier id', synced.supplierProductId === undefined);
  }

  // Walk every page and prove each product appears exactly once.
  const pageSize = 5;
  const seenIds = [];
  const totalPages = Math.ceil(EXPECTED / pageSize);
  for (let page = 1; page <= totalPages; page += 1) {
    const res = await anon(`GET`, `/api/products?page=${page}&pageSize=${pageSize}`);
    seenIds.push(...res.body.items.map((i) => i.id));
  }
  check('paging returns every active product exactly once', seenIds.length === EXPECTED && new Set(seenIds).size === EXPECTED, `walked=${seenIds.length} unique=${new Set(seenIds).size} expected=${EXPECTED}`);

  // filters — /api/categories returns a nested tree, so flatten to find a branch.
  const cats = await anon('GET', '/api/categories?depth=3');
  const flatCats = [];
  const flatten = (nodes, depth = 0) => {
    for (const n of nodes) {
      flatCats.push({ ...n, depth });
      flatten(n.children, depth + 1);
    }
  };
  flatten(cats.body.tree);
  const aCategory = flatCats.find((c) => c.productCount > 1) || flatCats[0];
  const byCat = await anon(`GET`, `/api/products?category=${encodeURIComponent(aCategory.slug)}`);
  check('category filter returns the whole subtree', byCat.body.total === aCategory.productCount, `api=${byCat.body.total} rollup=${aCategory.productCount}`);
  check(
    'every filtered item belongs to that category or a descendant',
    byCat.body.items.every((i) => aCategory.slug === i.category.slug || i.category.slug.startsWith(`${aCategory.slug}-`))
  );

  const cheap = await anon('GET', '/api/products?maxPrice=100');
  check('maxPrice filter works', cheap.body.items.every((i) => i.price <= 100), `count=${cheap.body.total}`);

  const instock = await anon('GET', '/api/products?inStock=1');
  check('inStock filter works', instock.body.items.every((i) => i.inStock === true));

  const rated = await anon('GET', '/api/products?minRating=4.7');
  check('minRating filter works', rated.body.items.every((i) => i.rating >= 4.7));

  // sorting
  const asc = await anon('GET', '/api/products?sort=price-asc&pageSize=50');
  const prices = asc.body.items.map((i) => i.price);
  check('price-asc is ascending', prices.every((p, i) => i === 0 || p >= prices[i - 1]), prices.join(','));
  const desc = await anon('GET', '/api/products?sort=price-desc&pageSize=50');
  const dprices = desc.body.items.map((i) => i.price);
  check('price-desc is descending', dprices.every((p, i) => i === 0 || p <= dprices[i - 1]), dprices.join(','));

  // sort keys are allowlisted, so injection attempts fall back to the default
  const bogus = await anon('GET', '/api/products?sort=price;DROP%20TABLE%20products--');
  check('unknown sort key is safe', bogus.status === 200 && bogus.body.total === EXPECTED, `status=${bogus.status} total=${bogus.body.total}`);
  const stillThere = await anon('GET', '/api/products?pageSize=50');
  check('products table survived the injection attempt', stillThere.body.total === EXPECTED, `total=${stillThere.body.total}`);

  // search: boolean FULLTEXT, then LIKE fallback for partial words
  const s1 = await anon('GET', '/api/products?q=headphones');
  check('fulltext search finds headphones', s1.body.total >= 1, `total=${s1.body.total}`);
  const s2 = await anon('GET', '/api/products?q=shoe');
  check('partial-word search falls back to LIKE', s2.body.total >= 1, `total=${s2.body.total}`);
  const s3 = await anon('GET', '/api/products?q=zzzznotathing');
  check('no-match search returns empty', s3.body.total === 0, `status=${s3.status} total=${s3.body.total}`);
  const s4 = await anon('GET', '/api/products?q=aura&pageSize=50');
  check('search returns rows without a 500', s4.status === 200 && Array.isArray(s4.body.items), `status=${s4.status}`);

  const trending = await anon('GET', '/api/products/trending?limit=4');
  check('trending returns 4', trending.body.items.length === 4);
  check('trending sorted by rating desc', trending.body.items.every((i, idx, arr) => idx === 0 || arr[idx - 1].rating >= i.rating));

  const suggest = await anon('GET', '/api/products/search?q=aura');
  check('typeahead finds Aura', suggest.body.items.some((i) => i.slug.includes('aura')));
}

/* ---------------------------------------------------------- product detail */
async function detailBlock() {
  const anon = makeClient();
  const fx = await resolveFixtures(anon);
  const target = fx.withVariants;

  const d = await anon('GET', `/api/products/${target.slug}`);
  check('detail 200', d.status === 200, `got ${d.status} for ${target.slug}`);
  const p = d.body.product;
  check('detail has at least one image', p.images.length >= 1, `got ${p.images.length}`);
  check('detail has the expected variants', p.variants.length === target.variants.length, `got ${p.variants.length}`);
  check('variant price falls back to product price', p.variants.every((v) => v.price === p.price));
  check('no supplier leak in detail', findSupplierLeak(d.body).length === 0, findSupplierLeak(d.body).join(', '));

  const rel = await anon('GET', `/api/products/${target.slug}/related`);
  check('related excludes the product itself', rel.body.items.every((i) => i.slug !== target.slug));

  const rev = await anon('GET', `/api/products/${target.slug}/reviews`);
  check('reviews return an array', Array.isArray(rev.body.items), `got ${typeof rev.body.items}`);

  const missing = await anon('GET', '/api/products/does-not-exist');
  check('unknown product 404s', missing.status === 404, `got ${missing.status}`);

  const ambiguous = await anon('GET', '/api/products/trending');
  check('literal route beats the :slug param', ambiguous.status === 200 && Array.isArray(ambiguous.body.items));

  // merchandising fields the storefront renders
  const listPage = await anon('GET', '/api/products?pageSize=1');

  // `specifications` is optional: it is populated for curated products but CJ
  // does not supply a structured spec list, so only the shape is guaranteed.
  check(
    'specifications, when present, is an array of pairs',
    p.specifications === null || p.specifications === undefined ||
      (Array.isArray(p.specifications) &&
        p.specifications.every((pair) => Array.isArray(pair) && pair.length >= 2)),
    JSON.stringify(p.specifications?.slice(0, 2))
  );
  check('published_at is exposed as createdAt', !!p.createdAt, String(p.createdAt));
  check('inStock is derived from stock', p.inStock === p.stock > 0);
  // The API returns the category nested; it is the CLIENT that flattens this to
  // categorySlug. Assert the server shape here.
  check('list items expose a nested category with a slug', typeof listPage.body.items[0].category?.slug === 'string', JSON.stringify(listPage.body.items[0].category));
}

/* -------------------------------------------------------------- categories */
async function categoryBlock() {
  const anon = makeClient();
  const { products: EXPECTED } = await expectedCounts();

  const c = await anon('GET', '/api/categories');
  check('categories 200', c.status === 200, `got ${c.status}`);
  check('tree has roots', Array.isArray(c.body.tree) && c.body.tree.length > 0, `roots=${c.body.tree && c.body.tree.length}`);

  // THE invariant: every top-level rollup must account for the whole catalogue
  // exactly once. This is what guarantees no product is double-counted across
  // branches or orphaned from navigation.
  const rollupSum = c.body.tree.reduce((n, x) => n + x.productCount, 0);
  check(
    'top-level rollups sum to the whole catalogue',
    rollupSum === EXPECTED,
    `rollup=${rollupSum} expected=${EXPECTED}`
  );

  // A parent must never report fewer than the sum of its children.
  let consistent = true;
  const walk = (nodes) => {
    const sum = nodes.reduce((s, n) => s + n.productCount, 0);
    if (nodes.length && nodes.some((n) => n.productCount < 1)) consistent = false;
    nodes.forEach((n) => {
      if (n.children.length && n.productCount < n.children.reduce((s, c2) => s + c2.productCount, 0)) {
        consistent = false;
      }
      walk(n.children);
    });
    return sum;
  };
  walk(c.body.tree);
  check('every branch reports at least one product', consistent);

  // Drilling into a branch must agree with the parent's rollup.
  const root = c.body.tree.find((n) => n.productCount > 0);
  const branch = await anon('GET', `/api/categories/${root.slug}`);
  check('branch detail 200', branch.status === 200, `got ${branch.status}`);
  check(
    'branch subtree count matches its parent rollup',
    branch.body.category.subtreeProductCount === root.productCount,
    `branch=${branch.body.category.subtreeProductCount} parent=${root.productCount}`
  );
  check(
    'branch children sum to less than or equal to the branch total',
    branch.body.category.children.reduce((s, x) => s + x.productCount, 0) <= branch.body.category.subtreeProductCount
  );

  // Filtering by a top-level slug must return that whole subtree.
  const filtered = await anon('GET', `/api/products?category=${encodeURIComponent(root.slug)}&pageSize=1`);
  check(
    'product filter on a parent category returns its whole subtree',
    filtered.body.total === root.productCount,
    `api=${filtered.body.total} rollup=${root.productCount}`
  );

  check('unknown category 404s', (await anon('GET', '/api/categories/definitely-not-a-category')).status === 404);
  check(
    'filtering by an unknown category returns nothing, not everything',
    (await anon('GET', '/api/products?category=definitely-not-a-category')).body.total === 0
  );
}

/* --------------------------------------------------------------- guest cart */
async function cartBlock() {
  const guest = makeClient();
  const anon = makeClient();
  const fx = await resolveFixtures(anon);

  const empty = await guest('GET', '/api/cart');
  check('new guest cart is empty', empty.body.cart.items.length === 0);
  check('cart exposes the free-shipping threshold', empty.body.cart.freeShippingThreshold === 150);

  const target = fx.withVariants;
  const v1 = target.variants?.[0];
  const v2 = target.variants?.[1];
  // A variant id is optional: a product with no options is added as a plain
  // line, which is itself worth exercising.
  const useVariant = Boolean(v1);
  const line = useVariant
    ? { productId: target.id, variantId: v1.id, quantity: 1 }
    : { productId: target.id, quantity: 1 };
  const PRICE = target.price;

  const add = await guest('POST', '/api/cart/items', line);
  check('add to cart 201', add.status === 201, `got ${add.status}`);
  check('cart now has 1 line', add.body.cart.items.length === 1);
  check('unit price came from the server', add.body.cart.items[0].unitPrice === PRICE, `got ${add.body.cart.items[0].unitPrice} expected ${PRICE}`);
  check('subtotal computed server-side', add.body.cart.subtotal === PRICE, `got ${add.body.cart.subtotal}`);
  const guestItemId = add.body.cart.items[0].id;

  // adding the same line again increments rather than duplicating
  const again = await guest('POST', '/api/cart/items', line);
  check('duplicate add increments quantity', again.body.cart.items.length === 1 && again.body.cart.items[0].quantity === 2);
  check('subtotal follows quantity', again.body.cart.subtotal === Math.round(PRICE * 100) / 100 * 2, `got ${again.body.cart.subtotal}`);

  const update = await guest('PATCH', `/api/cart/items/${guestItemId}`, { quantity: 1 });
  check('update quantity works', update.body.cart.items[0].quantity === 1);

  if (v2) {
    const twoLines = await guest('POST', '/api/cart/items', { productId: target.id, variantId: v2.id, quantity: 1 });
    check('a distinct variant becomes its own line', twoLines.body.cart.items.length === 2, `got ${twoLines.body.cart.items.length}`);
    await guest('DELETE', `/api/cart/items/${twoLines.body.cart.items.find((i) => i.variantId === v2.id).id}`);
  }

  const tooMany = await guest('PATCH', `/api/cart/items/${guestItemId}`, { quantity: 999 });
  check('over-stock quantity rejected', tooMany.status === 400, `got ${tooMany.status}`);
  const zeroQty = await guest('POST', '/api/cart/items', { ...line, quantity: 0 });
  check('zero quantity rejected', zeroQty.status === 400);

  // asking for more than the line actually holds
  const overStock = await guest('POST', '/api/cart/items', {
    ...line,
    quantity: (v1?.stock || target.stock || 1) + 500,
  });
  check('adding beyond available stock rejected', overStock.status === 400, `got ${overStock.status}`);

  if (useVariant) {
    const badVariant = await guest('POST', '/api/cart/items', { productId: target.id, variantId: '99999999', quantity: 1 });
    check('unknown variant rejected', badVariant.status === 400);
  }

  const badProduct = await guest('POST', '/api/cart/items', { productId: '99999999', quantity: 1 });
  check('unknown product rejected', badProduct.status === 400);

  // a variant id belonging to a DIFFERENT product must never resolve
  if (fx.withVariantsSecond?.variants?.[0]) {
    const crossed = await guest('POST', '/api/cart/items', {
      productId: target.id,
      variantId: fx.withVariantsSecond.variants[0].id,
      quantity: 1,
    });
    check('variant from another product rejected', crossed.status === 400, `got ${crossed.status}`);
  }

  const del = await guest('DELETE', `/api/cart/items/${guestItemId}`);
  check('remove single line 200', del.status === 200);
  await guest('DELETE', '/api/cart');
  const cleared = await guest('GET', '/api/cart');
  check('cart empties', cleared.body.cart.items.length === 0);
}

/* -------------------------------------------------------------------- auth */
async function authBlock() {
  const user = makeClient();
  const email = `smoke-${Date.now()}@zavora.test`;
  const password = 'testpass123';

  const reg = await user('POST', '/api/auth/register', { email, password, firstName: 'Smoke', lastName: 'Test' });
  check('register 201', reg.status === 201, `got ${reg.status}`);
  check('register returns the user', reg.body.user && reg.body.user.email === email);
  check('register never returns a hash', !JSON.stringify(reg.body).includes('$2b$'));

  const dupe = await makeClient()('POST', '/api/auth/register', { email, password });
  check('duplicate email 409s', dupe.status === 409, `got ${dupe.status}`);

  const weak = await makeClient()('POST', '/api/auth/register', { email: `weak-${Date.now()}@zavora.test`, password: 'short' });
  check('weak password rejected', weak.status === 400);

  const badEmail = await makeClient()('POST', '/api/auth/register', { email: 'not-an-email', password });
  check('invalid email rejected', badEmail.status === 400);

  const me = await user('GET', '/api/auth/me');
  check('me returns the session user', me.body.user && me.body.user.email === email);

  const anon = makeClient();
  check('orders require auth', (await anon('GET', '/api/orders')).status === 401);
  check('wishlist requires auth', (await anon('GET', '/api/wishlist')).status === 401);
  check('addresses require auth', (await anon('GET', '/api/addresses')).status === 401);

  const bad = await makeClient()('POST', '/api/auth/login', { email, password: 'wrongpass' });
  check('wrong password 401s', bad.status === 401);

  const relog = makeClient();
  const good = await relog('POST', '/api/auth/login', { email, password });
  check('login 200', good.status === 200, `got ${good.status}`);
  const meAfter = await relog('GET', '/api/auth/me');
  check('session works after login', meAfter.body.user && meAfter.body.user.email === email);

  const out = await relog('POST', '/api/auth/logout');
  check('logout 200', out.status === 200);
  const meOut = await relog('GET', '/api/auth/me');
  check('session cleared after logout', meOut.body.user === null);

  const admin = makeClient();
  const adminLogin = await admin('POST', '/api/auth/login', { email: 'admin@zavora.com', password: 'zavora-admin-2026' });
  check('admin login 200', adminLogin.status === 200, `got ${adminLogin.status}`);
  check('admin role is admin', adminLogin.body.user && adminLogin.body.user.role === 'admin');

  const forgot = await makeClient()('POST', '/api/auth/forgot-password', { email: 'nobody@nowhere.test' });
  check('forgot-password always 200s', forgot.status === 200, `got ${forgot.status}`);
}

/* ------------------------------------------------------------ demo account */
async function demoBlock() {
  const demo = makeClient();
  const anon = makeClient();

  const login = await demo('POST', '/api/auth/login', { email: 'demo@zavora.com', password: 'zavora1234' });
  check('demo login 200', login.status === 200, `got ${login.status}`);
  check('demo user is a customer', login.body.user && login.body.user.role === 'customer');

  const orders = await demo('GET', '/api/orders');
  check('demo has 5 orders', orders.body.items.length === 5, `got ${orders.body.items.length}`);
  check('order rows carry no supplier leak', findSupplierLeak(orders.body).length === 0);
  check('order rows carry no password hash', !JSON.stringify(orders.body).includes('password_hash'));

  const summary = await demo('GET', '/api/orders/summary');
  check('summary reports 5 orders', summary.body.summary.orderCount === 5, JSON.stringify(summary.body.summary));

  const one = await demo('GET', '/api/orders/ZV-8KQ2M1-447');
  check('order detail 200', one.status === 200);
  check('order detail has 2 items', one.body.order.items.length === 2, `got ${one.body.order.items.length}`);
  check('order has a captured payment', one.body.order.payment && one.body.order.payment.status === 'captured');
  check('order has a shipment with tracking', one.body.order.shipment && !!one.body.order.shipment.trackingNumber);

  check('unknown order number 404s', (await demo('GET', '/api/orders/ZV-NOT-MINE-000')).status === 404);

  // public tracking
  const track = await anon('POST', '/api/orders/lookup', { orderNumber: 'ZV-8KQ2M1-447', email: 'demo@zavora.com' });
  check('public tracking works', track.status === 200, `got ${track.status}`);
  check('tracking exposes a tracking number', !!track.body.order.trackingNumber);
  check('tracking hides the full address', track.body.order.shippingAddress === undefined);
  check('tracking reveals only a city', !!track.body.order.destination.city);
  check('tracking hides the customer email', track.body.order.email === undefined);

  const wrongEmail = await anon('POST', '/api/orders/lookup', { orderNumber: 'ZV-8KQ2M1-447', email: 'attacker@evil.test' });
  check('tracking with the wrong email 404s', wrongEmail.status === 404, `got ${wrongEmail.status}`);
  check('missing fields 400s', (await anon('POST', '/api/orders/lookup', { orderNumber: 'ZV-8KQ2M1-447' })).status === 400);

  return demo;
}

/* --------------------------------------------------------------- addresses */
async function addressBlock() {
  const demo = makeClient();
  await demo('POST', '/api/auth/login', { email: 'demo@zavora.com', password: 'zavora1234' });

  const list = await demo('GET', '/api/addresses');
  check('demo has 2 addresses', list.body.items.length === 2, `got ${list.body.items.length}`);
  check('exactly one default', list.body.items.filter((a) => a.isDefault).length === 1);

  // The "first address is automatically the default" rule. It silently stopped
  // working once because a row was destructured out of the wrong return shape,
  // so it is asserted explicitly for a brand-new account.
  const newcomer = makeClient();
  await newcomer('POST', '/api/auth/register', {
    email: `addr-${Date.now()}@zavora.test`,
    password: 'testpass123',
  });
  const first = await newcomer('POST', '/api/addresses', {
    label: 'Home',
    firstName: 'New',
    lastName: 'User',
    country: 'US',
    city: 'Austin',
    address1: '1 Main St',
    postalCode: '73301',
  });
  check('a customer\'s first address becomes their default', first.body.address && first.body.address.isDefault === true, `isDefault=${first.body.address && first.body.address.isDefault}`);

  const second = await newcomer('POST', '/api/addresses', {
    label: 'Work',
    firstName: 'New',
    lastName: 'User',
    country: 'US',
    city: 'Dallas',
    address1: '2 Side St',
    postalCode: '75001',
  });
  check('a second address is not made default', second.body.address.isDefault === false, `isDefault=${second.body.address.isDefault}`);
  const twoAddresses = await newcomer('GET', '/api/addresses');
  check('still exactly one default after adding a second', twoAddresses.body.items.filter((a) => a.isDefault).length === 1);

  const created = await demo('POST', '/api/addresses', {
    label: 'Studio',
    firstName: 'Alex',
    lastName: 'Moreau',
    phone: '+1 555 000 1234',
    country: 'us', // lowercase on purpose: must be normalised
    city: 'Oakland',
    address1: '500 Broadway',
    postalCode: '94607',
  });
  check('create address 201', created.status === 201, `got ${created.status}`);
  check('country normalised to upper case', created.body.address.country === 'US', created.body.address.country);
  const addressId = created.body.address.id;

  const incomplete = await demo('POST', '/api/addresses', { firstName: 'No' });
  check('incomplete address 400s with a field list', incomplete.status === 400 && Array.isArray(incomplete.body.details.missing));

  check('set default 200', (await demo('POST', `/api/addresses/${addressId}/default`)).status === 200);
  const after = await demo('GET', '/api/addresses');
  check('still exactly one default after the change', after.body.items.filter((a) => a.isDefault).length === 1);

  check('delete address 200', (await demo('DELETE', `/api/addresses/${addressId}`)).status === 200);
  check('deleting twice 404s', (await demo('DELETE', `/api/addresses/${addressId}`)).status === 404);

  // Deleting the default must promote another address, otherwise the customer
  // is left with no default and checkout has nothing to pre-select.
  const afterDelete = await demo('GET', '/api/addresses');
  check(
    'deleting the default address promotes another one',
    afterDelete.body.items.length > 0 && afterDelete.body.items.filter((a) => a.isDefault).length === 1,
    `addresses=${afterDelete.body.items.length} defaults=${afterDelete.body.items.filter((a) => a.isDefault).length}`
  );

  // cross-user isolation
  const intruder = makeClient();
  await intruder('POST', '/api/auth/login', { email: `smoke-`, password: 'testpass123' });
  const fresh = makeClient();
  await fresh('POST', '/api/auth/register', { email: `iso-${Date.now()}@zavora.test`, password: 'testpass123' });
  check('another user sees none of these orders', (await fresh('GET', '/api/orders')).body.items.length === 0);
  check('another user sees none of these addresses', (await fresh('GET', '/api/addresses')).body.items.length === 0);
  check("another user cannot read demo's order", (await fresh('GET', '/api/orders/ZV-8KQ2M1-447')).status === 404);
}

/* ---------------------------------------------------------------- wishlist */
async function wishlistBlock() {
  const demo = makeClient();
  const anon = makeClient();
  const fx = await resolveFixtures(anon);
  await demo('POST', '/api/auth/login', { email: 'demo@zavora.com', password: 'zavora1234' });

  const list = await demo('GET', '/api/wishlist');
  check('wishlist returns a list', Array.isArray(list.body.items), `got ${typeof list.body.items}`);
  check('wishlist has no supplier leak', findSupplierLeak(list.body).length === 0);

  // Toggle against whatever the catalogue currently holds.
  const targetId = fx.any.id;
  const starting = list.body.items.some((i) => i.id === targetId);

  const added = await demo('POST', '/api/wishlist', { productId: targetId });
  check(
    'toggling flips the membership state',
    added.body.inWishlist === !starting,
    `started=${starting} got=${added.body.inWishlist}`
  );

  const removed = await demo('POST', '/api/wishlist', { productId: targetId });
  check('toggling back restores the original state', removed.body.inWishlist === starting);

  check('wishlisting an unknown product 404s', (await demo('POST', '/api/wishlist', { productId: '99999999' })).status === 404);
}

/* ---------------------------------------------------------------- checkout */
async function checkoutBlock() {
  const buyer = makeClient();
  const anon = makeClient();

  const address = {
    firstName: 'Alex',
    lastName: 'Moreau',
    phone: '+1 555 000 1234',
    country: 'US',
    state: 'California',
    city: 'San Francisco',
    address1: '1200 Market Street',
    postalCode: '94103',
  };
  const goodPay = { cardNumber: '4242424242424242', cvc: '123', expiry: '12/30' };

  const emptyQuote = await buyer('POST', '/api/checkout/quote', { shippingMethod: 'standard' });
  check('empty cart quote 400s', emptyQuote.status === 400, `got ${emptyQuote.status}`);

  const methods = await anon('GET', '/api/checkout/shipping-methods');
  check('3 shipping methods', methods.body.methods.length === 3);

  // Pick a product UNDER the free-shipping threshold, so express shipping is
  // actually charged. Derived from the catalogue rather than hardcoded, since
  // the products change with every CJ sync. Note the sort direction: the
  // catalogue spans $0 to $1,476, so the cheap end has to be asked for
  // explicitly rather than assumed to be in the first page.
  const fx = await resolveFixtures(anon);
  const freeThreshold = (await anon('GET', '/api/cart')).body.cart.freeShippingThreshold;
  const cheapest = await anon('GET', '/api/products?pageSize=48&sort=price-asc');
  const dearest = await anon('GET', '/api/products?pageSize=48&sort=price-desc');
  const cheap = cheapest.body.items.find((i) => i.price > 0 && i.price < freeThreshold);
  check('a product below the free-shipping threshold exists', Boolean(cheap), 'catalogue has none');
  const PRICE = cheap.price;

  await buyer('POST', '/api/cart/items', { productId: cheap.id, quantity: 1 });

  // Quote WITH the destination. A quote without a country falls back to the
  // international multiplier, so it will not match an order shipped to the US —
  // that difference is deliberate, not a bug.
  const quote = await buyer('POST', '/api/checkout/quote', {
    shippingMethod: 'express',
    country: 'US',
  });
  check('quote 200', quote.status === 200, `got ${quote.status}`);
  check('quote subtotal is server-computed', quote.body.quote.subtotal === PRICE, `got ${quote.body.quote.subtotal} expected ${PRICE}`);
  check('quote echoes the destination zone', typeof quote.body.quote.shippingZone === 'string', String(quote.body.quote.shippingZone));
  // Express is never free, even below the threshold.
  check('express shipping is charged below the threshold', quote.body.quote.shippingAmount > 0, `got ${quote.body.quote.shippingAmount}`);
  const EXPECTED_TOTAL = Math.round((PRICE + quote.body.quote.shippingAmount) * 100) / 100;
  check('total = subtotal + shipping', quote.body.quote.total === EXPECTED_TOTAL, `got ${quote.body.quote.total} expected ${EXPECTED_TOTAL}`);
  check('quote carries a token', typeof quote.body.quote.quoteToken === 'string');

  // An undestinationed quote is only an estimate, so it must not undercut the
  // destination-aware quote.
  const intlQuote = await buyer('POST', '/api/checkout/quote', { shippingMethod: 'express' });
  check(
    'an undestinationed quote is not cheaper than a domestic one',
    intlQuote.body.quote.shippingAmount >= quote.body.quote.shippingAmount,
    `intl=${intlQuote.body.quote.shippingAmount} us=${quote.body.quote.shippingAmount}`
  );
  check('a blocked destination is rejected', (await buyer('POST', '/api/checkout/quote', { shippingMethod: 'express', country: 'RU' })).status === 400);

  // a client-supplied total must be ignored entirely
  const tampered = await buyer('POST', '/api/checkout/quote', {
    shippingMethod: 'express',
    country: 'US',
    subtotal: 0.01,
    total: 0.01,
  });
  check('client-sent total is ignored', tampered.body.quote.total === EXPECTED_TOTAL, `got ${tampered.body.quote.total}`);
  check('unknown shipping method 400s', (await buyer('POST', '/api/checkout/quote', { shippingMethod: 'teleport' })).status === 400);

  // payment validation happens before anything is written
  const badCard = await buyer('POST', '/api/checkout/place-order', {
    email: 'buyer@zavora.test', shippingAddress: address, shippingMethod: 'express',
    payment: { cardNumber: '1234', cvc: '123', expiry: '12/30' },
  });
  check('invalid card number 400s', badCard.status === 400, `got ${badCard.status}`);

  const badCvc = await buyer('POST', '/api/checkout/place-order', {
    email: 'buyer@zavora.test', shippingAddress: address, shippingMethod: 'express',
    payment: { cardNumber: '4242424242424242', cvc: 'x', expiry: '12/30' },
  });
  check('invalid cvc 400s', badCvc.status === 400);

  const badExpiry = await buyer('POST', '/api/checkout/place-order', {
    email: 'buyer@zavora.test', shippingAddress: address, shippingMethod: 'express',
    payment: { cardNumber: '4242424242424242', cvc: '123', expiry: '13/30' },
  });
  check('impossible expiry month 400s', badExpiry.status === 400);

  const expired = await buyer('POST', '/api/checkout/place-order', {
    email: 'buyer@zavora.test', shippingAddress: address, shippingMethod: 'express',
    payment: { cardNumber: '4242424242424242', cvc: '123', expiry: '01/20' },
  });
  check('expired card 400s', expired.status === 400, `got ${expired.status}`);

  const declined = await buyer('POST', '/api/checkout/place-order', {
    email: 'buyer@zavora.test', shippingAddress: address, shippingMethod: 'express',
    payment: { cardNumber: '4000000000000002', cvc: '123', expiry: '12/30' },
  });
  check('declined card reports PAYMENT_DECLINED', declined.status === 400 && declined.body.details && declined.body.details.code === 'PAYMENT_DECLINED', `status=${declined.status} body=${JSON.stringify(declined.body)}`);

  const badAddr = await buyer('POST', '/api/checkout/place-order', {
    email: 'buyer@zavora.test', shippingAddress: { firstName: 'A' }, shippingMethod: 'express', payment: goodPay,
  });
  check('incomplete address 400s with a field list', badAddr.status === 400 && Array.isArray(badAddr.body.details.missing));
  check('address2 is not reported as required', !badAddr.body.details.missing.includes('address2'), JSON.stringify(badAddr.body.details.missing));

  const noEmail = await buyer('POST', '/api/checkout/place-order', {
    shippingAddress: address, shippingMethod: 'express', payment: goodPay,
  });
  check('missing email 400s', noEmail.status === 400);

// the real order
  const stockBefore = (await anon('GET', `/api/products/${cheap.slug}`)).body.product.stock;
  const placed = await buyer('POST', '/api/checkout/place-order', {
    email: 'buyer@zavora.test', shippingAddress: address, shippingMethod: 'express', payment: goodPay,
  });
  check('place-order 201', placed.status === 201, `got ${placed.status} ${JSON.stringify(placed.body).slice(0, 160)}`);

  const orderNumber = placed.body.order && placed.body.order.orderNumber;
  check('order number matches ZV-XXXXXX-NNN', /^ZV-[A-Z0-9]{6}-\d{3}$/.test(orderNumber || ''), String(orderNumber));
  check('order total is server-computed', placed.body.order.total === EXPECTED_TOTAL, `got ${placed.body.order.total} expected ${EXPECTED_TOTAL}`);
  check('order line snapshots the price', placed.body.order.items[0].unitPrice === PRICE, `got ${placed.body.order.items[0].unitPrice}`);
  check('order line snapshots the product name', typeof placed.body.order.items[0].name === 'string' && placed.body.order.items[0].name.length > 0);
  check('payment captured', placed.body.order.payment.status === 'captured');
  check('card last4 recorded', placed.body.order.payment.cardLast4 === '4242');
  check('full card number is never stored or returned', !JSON.stringify(placed.body).includes('4242424242424242'));

  const stockAfter = (await anon('GET', `/api/products/${cheap.slug}`)).body.product.stock;
  check('stock decremented by 1', stockAfter === stockBefore - 1, `${stockBefore} -> ${stockAfter}`);

  check('cart emptied after checkout', (await buyer('GET', '/api/cart')).body.cart.items.length === 0);

  const tracked = await anon('POST', '/api/orders/lookup', { orderNumber, email: 'buyer@zavora.test' });
  check('guest order is trackable', tracked.status === 200, `got ${tracked.status}`);

  // free-shipping threshold: a basket ABOVE it gets standard shipping free.
  const watcher = makeClient();
  const expensive = dearest.body.items.find((i) => i.price > freeThreshold);
  if (expensive) {
    await watcher('POST', '/api/cart/items', { productId: expensive.id, quantity: 1 });
    const freeQuote = await watcher('POST', '/api/checkout/quote', { shippingMethod: 'standard' });
    check('free shipping over the threshold', freeQuote.body.quote.shippingAmount === 0, `got ${freeQuote.body.quote.shippingAmount} for $${expensive.price}`);
    const paidQuote = await watcher('POST', '/api/checkout/quote', { shippingMethod: 'priority' });
    check('express still costs over the threshold', paidQuote.body.quote.shippingAmount > 0);
  } else {
    check('a product above the free-shipping threshold exists', false, 'catalogue has none');
  }
}

/* ----------------------------------------------------------- oversell guard */
async function oversellBlock() {
  const { query, execute, withTransaction } = require('../database/pool');

  // The race is only meaningful when exactly one unit is left. The test creates
  // and destroys its own fixture rather than borrowing seeded stock, so it can
  // neither be affected by nor affect any other block, and can be re-run against
  // an already-synced, already-ordered database.
  const fixture = await withTransaction(async (conn) => {
    const [p] = await conn.execute(
      `INSERT INTO products
         (name, slug, sku, brand, short_description, price, stock, status, is_active, published_at)
       VALUES ('Smoke Race Product', 'smoke-race-product', 'SMOKE-RACE-1', 'ZAVORA',
               'Temporary fixture', 10.00, 1, 'active', 1, NOW())`
    );
    const [v] = await conn.execute(
      `INSERT INTO product_variants (product_id, name, option_type, sku, price, stock, position)
       VALUES (?, 'Race Option', 'color', 'SMOKE-RACE-1-A', NULL, 1, 0)`,
      [p.insertId]
    );
    return { productId: p.insertId, variantId: v.insertId };
  });

  try {
    const a = makeClient();
    const b = makeClient();
    const address = {
      firstName: 'Race',
      lastName: 'Test',
      country: 'US',
      city: 'Austin',
      address1: '1 Main St',
      postalCode: '73301',
    };
    const pay = { cardNumber: '4242424242424242', cvc: '123', expiry: '12/30' };

    const addedA = await a('POST', '/api/cart/items', {
      productId: fixture.productId,
      variantId: fixture.variantId,
      quantity: 1,
    });
    const addedB = await b('POST', '/api/cart/items', {
      productId: fixture.productId,
      variantId: fixture.variantId,
      quantity: 1,
    });
    check(
      'both sessions can hold the last unit in their carts',
      addedA.status === 201 && addedB.status === 201,
      `a=${addedA.status} b=${addedB.status}`
    );

    // Two independent sessions check out the same last unit at the same time.
    const [ra, rb] = await Promise.all([
      a('POST', '/api/checkout/place-order', {
        email: 'r1@zavora.test',
        shippingAddress: address,
        shippingMethod: 'standard',
        payment: pay,
      }),
      b('POST', '/api/checkout/place-order', {
        email: 'r2@zavora.test',
        shippingAddress: address,
        shippingMethod: 'standard',
        payment: pay,
      }),
    ]);

    const successes = [ra, rb].filter((r) => r.status === 201).length;
    const conflicts = [ra, rb].filter((r) => r.status === 409).length;
    check(
      'exactly one of two concurrent orders succeeds',
      successes === 1,
      `successes=${successes} conflicts=${conflicts} statuses=${[ra.status, rb.status]}`
    );
    check('the loser gets a 409 stock conflict', conflicts === 1, `successes=${successes} conflicts=${conflicts}`);

    const [{ stock_after: after }] = await query(
      'SELECT stock AS stock_after FROM product_variants WHERE id = ?',
      [fixture.variantId]
    );
    check('variant stock never goes negative', Number(after) >= 0, `stock=${after}`);
    check('the single unit was consumed exactly once', Number(after) === 0, `stock=${after}`);
  } finally {
    // Always clean up, even if an assertion threw.
    await withTransaction(async (conn) => {
      await conn.query('DELETE FROM cart_items WHERE product_id = ?', [fixture.productId]);
      await conn.query('DELETE FROM product_variants WHERE product_id = ?', [fixture.productId]);
      await conn.query('DELETE FROM products WHERE id = ?', [fixture.productId]);
    });
  }
}

/* -------------------------------------------------------------------- main */
async function main() {
  // Boot the API in-process on an ephemeral port unless the caller pointed us
  // at one, so the suite never depends on a separately started dev server.
  let base = API;
  if (!base) {
    const app = require('../app');
    server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s));
    });
    base = `http://127.0.0.1:${server.address().port}`;
  }
  const api = base;
  baseUrl = api;

  console.log(`API smoke test against ${api}\n`);

  const blocks = [
    ['health', healthBlock],
    ['catalogue', catalogueBlock],
    ['product detail', detailBlock],
    ['categories', categoryBlock],
    ['guest cart', cartBlock],
    ['auth', authBlock],
    ['demo account', demoBlock],
    ['addresses', addressBlock],
    ['wishlist', wishlistBlock],
    ['checkout', checkoutBlock],
    ['oversell', oversellBlock],
  ];

  for (const [name, fn] of blocks) {
    console.log(name);
    try {
      await fn();
    } catch (err) {
      failed += 1;
      failures.push(`${name} threw: ${err.message}`);
      console.log(`  ERROR ${name} threw: ${err.message}`);
      if (process.env.SMOKE_TRACE) console.log(err.stack);
    }
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
    await shutdown();
    process.exit(1);
  }
  console.log('All API checks passed.');
  await shutdown();
}

async function shutdown() {
  const { closePool } = require('../database/pool');
  if (server) await new Promise((r) => server.close(r));
  await closePool().catch(() => {});
}

main().catch(async (err) => {
  console.error('\nsmoke test crashed:', err);
  await shutdown();
  process.exit(1);
});