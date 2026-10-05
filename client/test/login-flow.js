/**
 * Renders the real login flow against the running API through the Vite proxy and
 * asserts each credential pair actually signs in.
 *
 * This exists because the login page has been the source of two separate
 * failures that a build could not catch: a `useAdmin is not defined`
 * ReferenceError, and an admin login rejected because the demo password was
 * still in the field. Both only appear when the component renders and submits.
 *
 * Usage: node test/login-flow.js
 */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const API = process.env.API_URL || 'http://localhost:5000';

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures += 1;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Any uncaught exception in the page is exactly the bug class being guarded.
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  // Each attempt needs its own context: once signed in, /login correctly
  // redirects an authenticated visitor to /account, which has no email field.
  const signIn = async (email, password) => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    p.on('pageerror', (e) => pageErrors.push(e.message));
    await p.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await p.fill('input[type="email"]', email);
    await p.fill('input[type="password"]', password);
    await p.click('button[type="submit"]');
    await p.waitForTimeout(2500);
    const url = p.url();
    await ctx.close();
    return url;
  };

  // 1. The page must render without a ReferenceError.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  check('login page renders with no ReferenceError', pageErrors.length === 0, pageErrors.join('; '));

  // 2. The admin autofill must fill BOTH fields (the original failure mode).
  await page.click('text=admin@zavora.com');
  await page.waitForTimeout(300);
  const filledEmail = await page.inputValue('input[type="email"]');
  const filledPassword = await page.inputValue('input[type="password"]');
  check(
    'admin autofill fills both fields',
    filledEmail === 'admin@zavora.com' && filledPassword === 'zavora-admin-2026',
    `${filledEmail} / ${filledPassword}`,
  );

  // 3. Customer credentials must authenticate.
  const customerUrl = await signIn('demo@zavora.com', 'zavora1234');
  check('customer sign-in succeeds', !customerUrl.includes('/login'), `landed on ${customerUrl}`);

  // 4. Admin credentials must authenticate.
  const adminUrl = await signIn('admin@zavora.com', 'zavora-admin-2026');
  check('admin sign-in succeeds', !adminUrl.includes('/login'), `landed on ${adminUrl}`);

  // 5. /admin must be reachable for the admin and must load live CJ status.
  //    Uses a real signed-in context: asserting on the earlier anonymous page
  //    passed for the wrong reason (it was sitting on /login).
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  adminPage.on('pageerror', (e) => pageErrors.push(`[admin] ${e.message}`));
  await adminPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await adminPage.click('text=admin@zavora.com');
  await adminPage.click('button[type="submit"]');
  await adminPage.waitForTimeout(2000);
  await adminPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(3000);
  check('admin stays on /admin (not bounced to login)', adminPage.url().includes('/admin'), `url ${adminPage.url()}`);
  const adminBody = await adminPage.textContent('body');
  check('admin dashboard rendered', /dashboard|revenue|orders/i.test(adminBody), `url ${adminPage.url()}`);

  // 6. The CJ panel must show the live token, not "not configured" / "none".
  await adminPage.goto(`${BASE}/admin/cj-sync`, { waitUntil: 'networkidle' });
  await adminPage.waitForTimeout(3500);
  const cjBody = await adminPage.textContent('body');
  check(
    'CJ panel no longer says "not configured"',
    !/not configured/i.test(cjBody),
    /not configured/i.test(cjBody) ? 'still reporting not configured' : '',
  );
  check(
    'CJ panel no longer says token "none"',
    !/\bnone\b/i.test(cjBody),
    /\bnone\b/i.test(cjBody) ? 'still reporting token none' : '',
  );
  check(
    'CJ panel shows the real account id',
    cjBody.includes('54102'),
    'expected openId 54102 on the panel',
  );
  await adminCtx.close();

  // 7. A customer must be redirected away from /admin.
  const ctx = await browser.newContext();
  const custPage = await ctx.newPage();
  custPage.on('pageerror', (e) => pageErrors.push(`[customer] ${e.message}`));
  await custPage.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await custPage.fill('input[type="email"]', 'demo@zavora.com');
  await custPage.fill('input[type="password"]', 'zavora1234');
  await custPage.click('button[type="submit"]');
  await custPage.waitForTimeout(2000);
  await custPage.goto(`${BASE}/account`, { waitUntil: 'networkidle' });
  await custPage.waitForTimeout(2500);
  const custBody = await custPage.textContent('body');
  check('account overview renders (was the .slice crash)', !/Something went wrong/i.test(custBody), `url ${custPage.url()}`);
  await custPage.goto(`${BASE}/account/orders`, { waitUntil: 'networkidle' });
  await custPage.waitForTimeout(2000);
  const custOrdersBody = await custPage.textContent('body');
  check('account orders page renders', !/Something went wrong/i.test(custOrdersBody), `url ${custPage.url()}`);
  await custPage.goto(`${BASE}/admin`, { waitUntil: 'networkidle' });
  await custPage.waitForTimeout(1500);
  check(
    'customer is redirected away from /admin',
    !custPage.url().includes('/admin'),
    `url ${custPage.url()}`,
  );
  await ctx.close();

  check('no uncaught page errors during the whole run', pageErrors.length === 0, pageErrors.join('; '));

  await browser.close();
  console.log(`\n${failures === 0 ? 'ALL PASS' : `${failures} FAILURE(S)`}  (api ${API})`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((err) => {
  console.error('harness error:', err.message);
  process.exit(1);
});