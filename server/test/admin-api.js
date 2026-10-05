/**
 * Verifies the admin API surface the step-15 dashboard depends on.
 * Usage: node test/admin-api.js
 */
const app = require('../app');
const { closePool } = require('../database/pool');

function makeClient(base) {
  let cookie = '';
  return async function call(method, path, body) {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, body: json };
  };
}

(async () => {
  const server = await new Promise((r) => {
    const s = app.listen(0, () => r(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  try {
    const admin = makeClient(base);
    const login = await admin('POST', '/api/auth/login', {
      email: 'admin@zavora.com',
      password: 'zavora-admin-2026',
    });
    console.log('login                     :', login.status);

    const ov = await admin('GET', '/api/admin/overview');
    const d = ov.body.overview;
    console.log('GET /admin/overview       :', ov.status);
    console.log(`  live products           : ${d.catalogue.activeProducts.toLocaleString()}`);
    console.log(`  archived                : ${d.catalogue.archivedProducts.toLocaleString()}`);
    console.log(`  categories              : ${d.catalogue.categories.toLocaleString()}`);
    console.log(`  variants                : ${d.catalogue.variants.toLocaleString()}`);
    console.log(`  supplier links          : ${d.catalogue.supplierRows.toLocaleString()}`);
    console.log(`  customers / orders      : ${d.customers} / ${d.orders.total}`);
    console.log(`  revenue collected       : $${d.revenue.collected}`);
    console.log(`  low stock rows          : ${d.lowStock.length}`);
    console.log(`  top categories          : ${d.topCategories.length}`);
    console.log(`  recent orders           : ${d.recentOrders.length}`);

    const products = await admin('GET', '/api/admin/products?pageSize=3');
    console.log('\nGET /admin/products       :', products.status, `(${products.body.total.toLocaleString()} total)`);
    const p = products.body.items[0];
    if (p) {
      console.log(`  ${p.name.slice(0, 42)}`);
      console.log(`    sell $${p.price}  cost $${p.supplier?.costPrice}  margin ${p.marginPercent}%  stock ${p.stock} (upstream ${p.supplier?.stock})`);
      console.log(`    category: ${p.category?.name}`);
    }

    const filtered = await admin('GET', '/api/admin/products?pageSize=1&lowStock=1');
    console.log('  low-stock filter        :', filtered.body.total, 'rows');

    const detail = await admin('GET', `/api/admin/products/${p?.id}`);
    console.log('GET /admin/products/:id   :', detail.status,
      detail.body.product ? `variants=${detail.body.product.variants.length} supplierCost=$${detail.body.product.supplier?.costPrice}` : '');

    const orders = await admin('GET', '/api/admin/orders?pageSize=3');
    console.log('\nGET /admin/orders        :', orders.status, `(${orders.body.total} total)`);
    orders.body.items.slice(0, 3).forEach((o) =>
      console.log(`  ${o.orderNumber}  ${o.status.padEnd(16)} $${o.total}  next=[${(o.allowedNext || []).join(',')}]`)
    );

    const statuses = await admin('GET', '/api/admin/orders/statuses');
    console.log('\nGET /admin/orders/statuses:', statuses.status, `(${statuses.body.statuses.length} states, ${statuses.body.shippingCountries.length} zones)`);

    const cj = await admin('GET', '/api/admin/cj/status');
    console.log('\nGET /admin/cj/status     :', cj.status,
      `configured=${cj.body.status.configured} authenticated=${cj.body.status.authenticated} runs=${cj.body.status.lastRuns.length}`);

    // The category tree the admin products page filters by.
    const tree = await admin('GET', '/api/categories?depth=3');
    console.log('\nGET /categories?depth=3   :', tree.status, `roots=${tree.body.tree.length} nodes=${tree.body.totalNodes}`);

    // Supplier cost must be reachable for admins and NOT for the storefront.
    const anon = makeClient(base);
    const pub = await anon('GET', '/api/products?pageSize=1');
    console.log('\npublic product payload    :', pub.status,
      pub.body.items[0] && pub.body.items[0].supplier ? 'LEAKED' : 'no supplier data');
  } finally {
    server.close();
  }

  await closePool();
})();