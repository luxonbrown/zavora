/** Focused probe: does a customer session actually establish in a fresh context? */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

page.on('pageerror', (e) => console.log('PAGEERROR:', e.message.slice(0, 220)));
page.on('console', (m) => {
  if (m.type() === 'error' && !/401|net::ERR|Failed to load/i.test(m.text())) {
    console.log('CONSOLE:', m.text().slice(0, 220));
  }
});

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('input[type="email"]', 'demo@zavora.com');
await page.fill('input[type="password"]', 'zavora1234');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

console.log('after submit url :', page.url());

const text = await page.textContent('body');
const hasError = /incorrect email|invalid email|something went wrong/i.test(text);
console.log('shows error      :', hasError);
if (hasError) console.log('error text       :', text.replace(/\s+/g, ' ').slice(0, 200));

const cookies = await ctx.cookies();
console.log('cookie names     :', cookies.map((c) => c.name).join(', ') || '(none)');

const me = await page.evaluate(async () => {
  const r = await fetch('/api/auth/me', { credentials: 'include' });
  return r.status;
});
console.log('/api/auth/me     :', me);

await browser.close();