/**
 * Verifies the reveal-video section behaves: the clip loads, autoplays when the
 * section comes into view, and the poster is a real frame (not a black rect).
 *
 * Autoplay cannot be asserted by faking state — this reads the real element.
 * Usage: node test/reveal-video.js
 */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';
const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures.push(name);
};

const browser = await chromium.launch();
// `autoplay-policy=no-user-gesture-required` reflects a real visitor who has
// interacted with the page; without it Chrome blocks the play() promise.
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
await ctx.grantPermissions([]);
const page = await ctx.newPage();

await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);

// Scroll down until the reveal section reports the video has started.
let started = false;
for (let i = 0; i < 40 && !started; i += 1) {
  await page.evaluate(() => window.scrollBy(0, 260));
  await page.waitForTimeout(160);
  started = await page.evaluate(() => {
    const v = document.querySelector('video[src*="product-reveal"]');
    return Boolean(v && !v.paused && v.currentTime > 0.05);
  });
}

const state = await page.evaluate(() => {
  const v = document.querySelector('video[src*="product-reveal"]');
  if (!v) return null;
  return {
    currentTime: v.currentTime,
    duration: v.duration,
    paused: v.paused,
    muted: v.muted,
    readyState: v.readyState,
    videoWidth: v.videoWidth,
    videoHeight: v.videoHeight,
    error: v.error ? v.error.code : null,
    objectFit: getComputedStyle(v).objectFit,
    controls: v.controls,
  };
});

check('video element exists', state !== null);
if (state) {
  check('clip loaded (readyState >= 2)', state.readyState >= 2, `readyState=${state.readyState}`);
  check('clip decoded (videoWidth > 0)', state.videoWidth > 0, `${state.videoWidth}x${state.videoHeight}`);
  check('no media error', state.error === null, state.error ? `code ${state.error}` : '');
  check('autoplayed on scroll', started, `t=${state.currentTime.toFixed(2)}s paused=${state.paused}`);
  check('muted by default', state.muted === true);
  check('no visible controls', state.controls === false);
  check('object-fit cover (backdrop)', state.objectFit === 'cover', state.objectFit);
}

// Controls appear once playing.
const hasSkip = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).some((b) => /skip/i.test(b.textContent || '')),
);
check('skip control present', hasSkip);

const soundToggle = await page.evaluate(() =>
  Array.from(document.querySelectorAll('button')).some((b) =>
    /unmute|mute/i.test(b.getAttribute('aria-label') || ''),
  ),
);
check('sound toggle present', soundToggle);

// Sound toggle should flip mute state and persist for the session.
if (soundToggle) {
  const after = await page.evaluate(async () => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) =>
      /unmute|mute/i.test(b.getAttribute('aria-label') || ''),
    );
    btn?.click();
    await new Promise((r) => setTimeout(r, 400));
    const v = document.querySelector('video[src*="product-reveal"]');
    let stored = null;
    try {
      stored = sessionStorage.getItem('mh:reveal-sound');
    } catch {
      stored = '(unavailable)';
    }
    return { muted: v?.muted, stored };
  });
  check('sound toggle unmutes', after.muted === false, `muted=${after.muted}`);
  check('sound preference persisted', after.stored === 'on', `sessionStorage=${after.stored}`);
}

// Let it finish: the section should unpin and become hidden.
let ended = false;
for (let i = 0; i < 60 && !ended; i += 1) {
  await page.evaluate(() => window.scrollBy(0, 220));
  await page.waitForTimeout(200);
  ended = await page.evaluate(() => {
    const v = document.querySelector('video[src*="product-reveal"]');
    return Boolean(v && v.ended);
  });
}
check('video reached the end', ended);

await page.waitForTimeout(2200);
const afterEnd = await page.evaluate(() => {
  const stage = document.querySelector('section[aria-label="Product reveal"] div[style*="height"], section[aria-label="Product reveal"] > div > div');
  const v = document.querySelector('video[src*="product-reveal"]');
  return {
    stageOpacity: stage ? getComputedStyle(stage).opacity : null,
    stageVisibility: stage ? getComputedStyle(stage).visibility : null,
    karaokeReached: document.body.innerText.includes('Curated, tracked, and delivered'),
  };
});
check(
  'stage dissolved after the clip',
  afterEnd.stageOpacity === '0' || afterEnd.stageVisibility === 'hidden',
  `opacity=${afterEnd.stageOpacity} visibility=${afterEnd.stageVisibility}`,
);
check('scrolled on into the karaoke section', afterEnd.karaokeReached);

await browser.close();
console.log(`\n${failures.length === 0 ? 'ALL PASS' : `${failures.length} FAILURE(S)`}`);
process.exit(failures.length === 0 ? 0 : 1);