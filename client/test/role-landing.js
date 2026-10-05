/**
 * Focused check: where does each role land immediately after signing in?
 * Usage: node test/role-landing.js
 */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch();

  for (const [label, email, password, expected] of [
    ['admin', 'admin@zavora.com', 'zavora-admin-2026', '/admin'],
    ['customer', 'demo@zavora.com', 'zavora1234', '/account'],
  ]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);

    // Capture what the API says the role is, independent of the UI.
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2500);
    const url = page.url();

    const me = await page.evaluate(async () => {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      const j = await r.json();
      return j?.user?.role ?? null;
    });

    const ok = url.endsWith(expected);
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: landed ${url} (expected ${expected})  api role=${me}`);
    await ctx.close();
  }

  await browser.close();
})().catch((e) => {
  console.error('harness error:', e.message);
  process.exit(1);
});