/**
 * Identifies what is actually painting the viewport at a given scroll offset by
 * hit-testing real viewport points and walking up the ancestor chain. Listing
 * "large elements" is not decisive — plenty of them are scrolled off screen.
 */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const target = Number(process.argv[2] ?? 2050);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

for (let i = 0; i < 20; i += 1) {
  await page.evaluate((v) => window.scrollTo(0, v), (target * i) / 19);
  await page.waitForTimeout(80);
}
await page.waitForTimeout(2200);

const result = await page.evaluate(() => {
  const points = [
    [40, 40],
    [720, 120],
    [720, 450],
    [720, 860],
    [1380, 860],
  ];
  return points.map(([x, y]) => {
    const chain = [];
    let el = document.elementFromPoint(x, y);
    let depth = 0;
    while (el && depth < 8) {
      const cs = getComputedStyle(el);
      chain.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className || '').toString().slice(0, 52),
        data: Object.keys(el.dataset).join(','),
        bg: cs.backgroundColor,
        img: cs.backgroundImage === 'none' ? '' : cs.backgroundImage.slice(0, 54),
        op: cs.opacity,
      });
      el = el.parentElement;
      depth += 1;
    }
    return { point: `${x},${y}`, chain };
  });
});

for (const { point, chain } of result) {
  console.log(`\n===== viewport point ${point} =====`);
  for (const c of chain) {
    console.log(`  <${c.tag}> data="${c.data}" op=${c.op} bg=${c.bg}`);
    if (c.img) console.log(`      bg-image: ${c.img}`);
    console.log(`      class: ${c.cls}`);
  }
}

await browser.close();