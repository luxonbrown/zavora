/** Finds which elements overflow the viewport horizontally at each scroll point. */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

for (const y of [0, 800, 2200, 5000, 6100, 8000, 9300]) {
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(900);

  const report = await page.evaluate(() => {
    const vw = window.innerWidth;
    const offenders = [];
    document.querySelectorAll('body *').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > vw + 2 && r.width < 4000) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || '').toString().slice(0, 44),
          right: Math.round(r.right),
          width: Math.round(r.width),
          left: Math.round(r.left),
        });
      }
    });
    // Deduplicate by class+right.
    return offenders.slice(0, 6);
  });

  console.log(`scrollY=${Number(y)}  (contentW=${await page.evaluate(() => document.documentElement.scrollWidth)})`);
  report.forEach((o) =>
    console.log(
      `   <${o.tag}> right=${o.right} w=${o.width}  class="${o.cls}"`,
    ),
  );
}

await browser.close();