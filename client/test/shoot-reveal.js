/**
 * Scrolls until the reveal video is actively playing, then screenshots — proof
 * by pixels rather than by assertion.
 * Usage: node test/shoot-reveal.js
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const OUT = 'C:/Users/emman/AppData/Local/Temp/mh-shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

let playing = null;
for (let i = 0; i < 60 && !playing; i += 1) {
  await page.evaluate(() => window.scrollBy(0, 220));
  await page.waitForTimeout(140);
  playing = await page.evaluate(() => {
    const v = document.querySelector('video[src*="product-reveal"]');
    if (!v || v.paused || v.currentTime < 0.3) return null;
    const cs = getComputedStyle(v);
    return {
      t: Number(v.currentTime.toFixed(2)),
      duration: Number((v.duration || 0).toFixed(2)),
      opacity: cs.opacity,
      visibility: cs.visibility,
      display: cs.display,
      rect: (() => {
        const r = v.getBoundingClientRect();
        return `${Math.round(r.width)}x${Math.round(r.height)}`;
      })(),
    };
  });
}

console.log(playing ? `playing: ${JSON.stringify(playing)}` : 'NOT PLAYING after 60 scroll steps');

if (playing) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/reveal-playing.png` });
  console.log(`${OUT}/reveal-playing.png`);
}

await browser.close();