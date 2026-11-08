// Renders the vertical promo to promo/out/xmas-tree-kit-promo.mp4
// node promo/render.mjs [--from N --to M]  (needs ffmpeg)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? Number(process.argv[i + 1]) : d;
};
const OUT = 'promo/out';
const FRAMES = `${OUT}/frames`;
const pickArg = process.argv.indexOf('--pick');
const pick = pickArg > 0 ? process.argv[pickArg + 1].split(',').map(Number) : null; // sample frames only
const partial = process.argv.includes('--from') || !!pick;
if (!partial) rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const server = await createServer({ configFile: 'vite.site.config.js', server: { port: 5324, open: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e));
await page.goto('http://localhost:5324/promo/?render');
await page.waitForFunction(() => window.__promo?.ready, null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
const total = await page.evaluate(() => window.__promo.frames);
const from = arg('--from', 0);
const to = Math.min(total, arg('--to', total));
const t0 = Date.now();
const list = pick ?? Array.from({ length: to - from }, (_, k) => from + k);
for (const i of list) {
  await page.evaluate((n) => window.__promo.frame(n), i);
  await page.screenshot({ path: `${FRAMES}/${String(i).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
  if (i % 60 === 0) console.log(`frame ${i}/${total}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
await browser.close();
await server.close();
if (partial) process.exit(0);

execFileSync('node', ['promo/music.mjs', `${OUT}/music.wav`], { stdio: 'inherit' });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${FRAMES}/%05d.jpg`, '-i', `${OUT}/music.wav`,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  '-c:a', 'aac', '-b:a', '192k', '-shortest', `${OUT}/xmas-tree-kit-promo.mp4`], { stdio: 'inherit' });
console.log(`done: ${OUT}/xmas-tree-kit-promo.mp4`);
