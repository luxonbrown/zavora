/**
 * Live health check for both APIs.
 *   1. CJdropshipping  — are the stored credentials still accepted?
 *   2. ZAVORA API      — does our own API serve real data?
 *
 * Read-only. Boots nothing that outlives the process.
 * Usage: node test/live-check.js
 */
const app = require('../app');
const { closePool } = require('../database/pool');
const client = require('../services/cj/client');
const tokenStore = require('../services/cj/token');

function line(label, ok, detail) {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  — ${detail}` : ''}`);
  return ok;
}

async function checkCj() {
  console.log('\n1. CJdropshipping credentials');
  try {
    const status = await tokenStore.status();
    line('apiKey configured', status.configured, status.configured ? '' : 'set cj.apiKey in server/config.js');
    line('access token held', status.hasToken, `openId ${status.openId}, expires ${status.expiresAt}`);
    line('token not expired', status.expired === false);

    // One real catalogue call. size=1 keeps the request budget minimal.
    const result = await client.listProducts({ page: 1, size: 1 });
    line('live product call succeeded', result.products.length > 0, `${result.totalRecords} products upstream`);

    const mapped = require('../services/cj/mapper').mapProduct(result.products[0]);
    line('cost and sell price separated', mapped.product.price !== mapped.supplier.cost_price,
      `cost ${mapped.supplier.cost_price} -> sell ${mapped.product.price}`);
    return true;
  } catch (err) {
    line('CJ call failed', false, `${err.message}${err.cjCode ? ` (CJ code ${err.cjCode})` : ''}`);
    return false;
  }
}

async function checkZavora() {
  console.log('\n2. ZAVORA API (own server)');
  const server = await new Promise((r) => {
    const s = app.listen(0, () => r(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  const call = async (method, path, body, cookie) => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const set = res.headers.get('set-cookie');
    let json = null;
    try {
      json = await res.json();
    } catch {
      json = null;
    }
    return { status: res.status, body: json, cookie: set ? set.split(';')[0] : cookie };
  };

  try {
    const health = await call('GET', '/api/health');
    line('health', health.status === 200 && health.body.database === 'up',
      `database=${health.body.database}`);

    const products = await call('GET', '/api/products?pageSize=5');
    line('product list', products.status === 200 && products.body.items.length > 0,
      `${products.body.total} products, showing ${products.body.items.length}`);

    const first = products.body.items[0];
    line('products carry a real price', typeof first.price === 'number' && first.price > 0,
      `${first.name.slice(0, 34)} — $${first.price}`);

    const cats = await call('GET', '/api/categories');
    line('categories', cats.status === 200 && cats.body.items.length > 0, `${cats.body.items.length} categories`);

    const noLeak = !JSON.stringify(products.body).match(/cost_price|supplier_/i);
    line('no supplier cost in public data', noLeak);

    // Authenticated flow end to end.
    const login = await call('POST', '/api/auth/login', {
      email: 'demo@zavora.com',
      password: 'zavora1234',
    });
    line('login', login.status === 200 && login.body.user?.email === 'demo@zavora.com');

    const orders = await call('GET', '/api/orders', undefined, login.cookie);
    line('orders (authenticated)', orders.status === 200, `${orders.body.items.length} orders`);

    const adminGate = await call('GET', '/api/admin/cj/status', undefined, login.cookie);
    line('admin route rejects a customer', adminGate.status === 403, `got ${adminGate.status}`);

    const track = await call('POST', '/api/orders/lookup', {
      orderNumber: 'ZV-8KQ2M1-447',
      email: 'demo@zavora.com',
    });
    line('public tracking', track.status === 200, `status ${track.body.order?.status}`);
    return true;
  } catch (err) {
    line('ZAVORA check errored', false, err.message);
    return false;
  } finally {
    server.close();
  }
}

(async () => {
  const cj = await checkCj();
  const zavora = await checkZavora();
  console.log(`\n${cj && zavora ? 'Both APIs are working.' : 'One or more checks FAILED.'}`);
  await closePool();
  process.exit(cj && zavora ? 0 : 1);
})();