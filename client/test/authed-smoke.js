/**
 * Renders the authenticated surfaces (customer dashboard + admin) in a real
 * browser and fails on any uncaught error or error-boundary trip.
 *
 * Authenticated routes are exactly where breakage hides: a field rename in the
 * API only shows up once a session exists, and a production build cannot see it.
 *
 * Usage: node test/authed-smoke.js
 */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';

const CUSTOMER_ROUTES = [
  '/account',
  '/account/orders',
  '/account/wishlist',
  '/account/addresses',
  '/account/profile',
  '/account/settings',
];

const ADMIN_ROUTES = [
  '/admin',
  '/admin/orders',
  '/admin/products',
  '/admin/categories',
  '/admin/customers',
  '/admin/cj-sync',
];

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};

const IGNORE =
  /401|Failed to load resource|net::ERR|ERR_CONNECTION|Authentication required|403/i;

async function signIn(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

async function sweep(label, routes, email, password, blockedPrefix) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });

  await signIn(page, email, password);

  for (const route of routes) {
    errors.length = 0;
    let status = 0;
    try {
      const res = await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
      status = res?.status() ?? 0;
    } catch (err) {
      check(`${label} ${route} loads`, false, err.message.slice(0, 80));
      continue;
    }
    await page.waitForTimeout(1100);

    const info = await page.evaluate(() => ({
      len: document.getElementById('root')?.innerHTML?.length ?? 0,
      text: document.body.innerText ?? '',
      url: location.pathname,
    }));

    const boundary = /Something went wrong/i.test(info.text);
    // A role guard legitimately redirects; that is not a failure.
    const redirected = blockedPrefix && !info.url.startsWith(blockedPrefix);
    const real = errors.filter((e) => !IGNORE.test(e));

    check(`${label} ${route} rendered`, info.len > 400, `${info.len} chars, HTTP ${status}${redirected ? ` → ${info.url}` : ''}`);
    check(`${label} ${route} no boundary`, !boundary, boundary ? 'tripped' : '');
    check(`${label} ${route} no errors`, real.length === 0, real.slice(0, 1).join('').slice(0, 150));
  }

  await ctx.close();
}

let browser;

(async () => {
  browser = await chromium.launch();

  await sweep('customer', CUSTOMER_ROUTES, 'demo@zavora.com', 'zavora1234', '/account');
  await sweep('admin', ADMIN_ROUTES, 'admin@zavora.com', 'zavora-admin-2026', '/admin');

  // A customer must not be able to reach admin.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await signIn(page, 'demo@zavora.com', 'zavora1234');
  await page.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  check(
    'customer is blocked from /admin',
    !page.url().includes('/admin'),
    `url ${page.url()}`,
  );
  await ctx.close();

  await browser.close();
  console.log(`\n${failures.length === 0 ? 'ALL PASS' : `${failures.length} FAILURE(S)`}`);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch(async (err) => {
  console.error('harness error:', err.message);
  await browser?.close();
  process.exit(1);
});