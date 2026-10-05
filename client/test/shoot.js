/**
 * Captures full-page screenshots for visual review.
 * Usage: node test/shoot.js <name> <route> [width] [height] [full]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const OUT = 'C:/Users/emman/AppData/Local/Temp/mh-shots';
mkdirSync(OUT, { recursive: true });

const [, , name, route, w = '1440', h = '900', full = 'true'] = process.argv;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: Number(w), height: Number(h) },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();

if (route.startsWith('auth:')) {
  const [, , creds] = route.split(':');
  const [email, password] = creds.split('|');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(2500);
}

await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
// Let entrance animations and lazy scenes settle.
await page.waitForTimeout(3500);
// Trigger scroll-driven reveals by walking down the page, then return to top.
if (full === 'true') {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.8;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 220));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
}

const path = `${OUT}/${name}.png`;
await page.screenshot({ path, fullPage: full === 'true' });
console.log(path);

await browser.close();