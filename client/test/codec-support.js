/** Reports which video codecs the running browser can actually decode. */
import { chromium } from 'playwright';

const BASE = process.env.CLIENT_URL || 'http://localhost:5173';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE, { waitUntil: 'domcontentloaded' });

const caps = await page.evaluate(() => {
  const v = document.createElement('video');
  return {
    h264: v.canPlayType('video/mp4; codecs="avc1.42E01E"'),
    mp4: v.canPlayType('video/mp4'),
    aac: v.canPlayType('audio/mp4; codecs="mp4a.40.2"'),
    vp9: v.canPlayType('video/webm; codecs="vp9"'),
    userAgent: navigator.userAgent,
  };
});

console.log(`browser : ${caps.userAgent}\n`);
console.log(`H.264 (avc1) : "${caps.h264}"`);
console.log(`MP4 generic : "${caps.mp4}"`);
console.log(`AAC         : "${caps.aac}"`);
console.log(`VP9 / webm  : "${caps.vp9}"`);
console.log(
  caps.h264
    ? '\nH.264 SUPPORTED — a blank frame here would be a real app bug.'
    : '\nH.264 NOT SUPPORTED — this browser build cannot decode the clip, so the\nvideo reports readyState/dimensions but paints nothing. Not an app bug.',
);

await browser.close();