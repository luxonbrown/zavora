/**
 * Renders every public storefront route in a real browser and fails on any
 * uncaught error, React error-boundary trip, or empty root.
 *
 * A production build cannot catch runtime faults — an unresolved import inside a
 * lazy chunk, a context hook used outside its provider, or a GSAP/ScrollTrigger
 * misconfiguration all compile cleanly and then throw on first paint. That is
 * exactly the class of bug that shipped twice during the login work.
 *
 * Usage: node test/render-smoke.js [route ...]
 */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';

const ROUTES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      '/',
      '/shop',
      '/search?q=shirt',
      '/category/new-arrivals',
      '/cart',
      '/about',
      '/contact',
      '/track-order',
      '/login',
      '/register',
      '/forgot-password',
      '/nonexistent-page-xyz',
    ];

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};

(async () => {
  const browser = await chromium.launch();

  for (const route of ROUTES) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`);
    });

    let status = 0;
    try {
      const response = await page.goto(`${BASE}${route}`, {
        waitUntil: 'networkidle',
        timeout: 45000,
      });
      status = response?.status() ?? 0;
    } catch (err) {
      check(`${route} loads`, false, err.message.slice(0, 90));
      await ctx.close();
      continue;
    }

    await page.waitForTimeout(1200);

    const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML ?? '');
    const bodyText = await page.evaluate(() => document.body.innerText ?? '');
    const boundaryTripped = /Something went wrong/i.test(bodyText);

    // Filter out expected noise: a 401 from an anonymous session probe and
    // failed image fetches are not render faults.
    const realErrors = errors.filter(
      (e) =>
        !/401|Failed to load resource|net::ERR|ERR_CONNECTION|Authentication required/i.test(e),
    );

    check(`${route} rendered`, rootHtml.length > 400, `${rootHtml.length} chars, HTTP ${status}`);
    check(`${route} no error boundary`, !boundaryTripped, boundaryTripped ? 'boundary tripped' : '');
    check(
      `${route} no runtime errors`,
      realErrors.length === 0,
      realErrors.slice(0, 2).join(' | ').slice(0, 160),
    );

    await ctx.close();
  }

  await browser.close();
  console.log(`\n${failures.length === 0 ? 'ALL PASS' : `${failures.length} FAILURE(S)`}`);
  process.exit(failures.length === 0 ? 0 : 1);
})().catch((err) => {
  console.error('harness error:', err.message);
  process.exit(1);
});