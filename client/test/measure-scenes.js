/** Prints each homepage scene's real geometry, so screenshots can target it. */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const out = [];
  document.querySelectorAll('main section, main > div > section').forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const top = r.top + window.scrollY;
    out.push({
      i,
      h: Math.round(r.height),
      top: Math.round(top),
      bottom: Math.round(top + r.height),
      cls: (el.className || '').toString().slice(0, 70),
      label: (el.getAttribute('aria-label') || el.textContent || '')
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 46),
    });
  });
  return {
    docHeight: document.body.scrollHeight,
    viewport: window.innerHeight,
    sections: out,
  };
});

console.log(`doc height : ${info.docHeight}`);
console.log(`viewport   : ${info.viewport}`);
console.log(`scrollable : ${info.docHeight - info.viewport}\n`);
for (const s of info.sections) {
  console.log(
    `#${s.i} top=${String(s.top).padStart(6)} h=${String(s.h).padStart(6)} bot=${String(s.bottom).padStart(6)}  ${s.label}`,
  );
}

await browser.close();