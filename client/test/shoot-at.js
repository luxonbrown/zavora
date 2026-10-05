/**
 * Scrolls to a given pixel offset and captures the viewport, so pinned/scrubbed
 * GSAP scenes can actually be inspected. A full-page screenshot of a pinned
 * section is meaningless — the pin collapses the section to one viewport and
 * the timeline state is whatever the capture left it in.
 *
 * Usage: node test/shoot-at.js <name> <route> <scrollY> [w] [h]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const OUT = 'C:/Users/emman/AppData/Local/Temp/mh-shots';
mkdirSync(OUT, { recursive: true });

const [, , name, route, scrollY = '0', w = '1440', h = '900'] = process.argv;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h } });
const page = await ctx.newPage();

await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

// Lenis owns the scroll position, so step through rather than jumping — the
// scrubbed timelines need intermediate frames to advance.
const target = Number(scrollY);
const steps = 24;
const from = await page.evaluate(() => window.scrollY);
for (let i = 1; i <= steps; i += 1) {
  const y = from + ((target - from) * i) / steps;
  await page.evaluate((v) => window.scrollTo(0, v), y);
  await page.waitForTimeout(90);
}
// Let ScrollTrigger settle on the final position.
await page.waitForTimeout(2200);

const path = `${OUT}/${name}.png`;
await page.screenshot({ path });
console.log(`${path}  (scrollY=${await page.evaluate(() => Math.round(window.scrollY))})`);

await browser.close();