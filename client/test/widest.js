/** Reports the elements whose right edge defines the horizontal scroll width. */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const y = Number(process.argv[2] ?? 6000);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.evaluate((v) => window.scrollTo(0, v), y);
await page.waitForTimeout(1100);

const { scrollW, rows } = await page.evaluate(() => {
  const rows = [];
  document.querySelectorAll('body *').forEach((el) => {
    const b = el.getBoundingClientRect();
    const right = b.right + window.scrollX;
    const width = b.width;
    if (width > 0)
      rows.push({
        right: Math.round(right),
        width: Math.round(width),
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 52),
      });
  });
  rows.sort((a, b) => b.right - a.right);
  return { scrollW: document.documentElement.scrollWidth, rows: rows.slice(0, 10) };
});

console.log(`scrollY=${y}  scrollWidth=${scrollW}\n`);
for (const o of rows)
  console.log(`right=${o.right}\tw=${o.width}\t<${o.tag}>\t${o.cls}`);

await browser.close();