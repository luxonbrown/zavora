/** Prints the complete error text + stack for one route. */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const route = process.argv[2] || '/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('pageerror', (e) => {
    console.log('=== PAGE ERROR ===');
    console.log(e.message);
    console.log('--- stack ---');
    console.log(e.stack ?? '(none)');
  });

  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (/401|Failed to load resource|net::ERR/i.test(text)) return;
    console.log('=== CONSOLE ERROR ===');
    console.log(text.slice(0, 3000));
  });

  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.waitForTimeout(2500);

  const boundary = await page.evaluate(() => /Something went wrong/i.test(document.body.innerText));
  console.log('\nboundary tripped:', boundary);

  await browser.close();
})().catch((e) => {
  console.error('harness error:', e.message);
  process.exit(1);
});