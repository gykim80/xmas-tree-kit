// Records the sample shop (examples/adopt/) as an animated WebP for the README: docs/adopt.webp
// node scripts/record-shop.mjs  (needs img2webp; frames go to tmp/shop-frames/)
// Every frame is stepped by hand: each tree's camera turns by a fixed angle and the tree clock is set,
// so the spin speed doesn't depend on how fast screenshots are taken.
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const FPS = 20;
const W = 1200;
const H = 750;
const OUT_W = 900;
const FRAMES = 'tmp/shop-frames';
rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });

const server = await createServer({ configFile: 'vite.site.config.js', server: { port: 5325, open: false }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('page error:', e));
await page.goto('http://localhost:5325/examples/adopt/');
await page.waitForFunction(() => [...document.querySelectorAll('xmas-tree')].every((e) => e.tree), null, { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; }' });
await page.waitForTimeout(1500);

// Take over the clocks: no auto-rotate, the script turns the cameras
await page.evaluate(() => {
  window.__rec = {
    els: [...document.querySelectorAll('xmas-tree')],
    t: 0,
    step(dt) {
      this.t += dt;
      for (const el of this.els) {
        const v = el.viewer;
        if (v.controls) v.controls.autoRotate = false;
        const target = v.controls?.target;
        if (target) {
          const off = v.camera.position.clone().sub(target);
          const a = dt * ((Math.PI * 2) / 9); // one turn per 9 seconds
          const c = Math.cos(a), s = Math.sin(a);
          v.camera.position.set(target.x + off.x * c + off.z * s, v.camera.position.y, target.z - off.x * s + off.z * c);
          v.camera.lookAt(target);
        }
        el.tree.update(this.t);
      }
    },
  };
});

let n = 0;
const shot = async () => {
  await page.evaluate((dt) => window.__rec.step(dt), 1 / FPS);
  // two animation frames so every viewer has drawn the new pose
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.screenshot({ path: `${FRAMES}/${String(n++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
};
const hold = async (sec) => {
  for (let i = 0; i < sec * FPS; i++) await shot();
};
const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const scrollTo = async (sel, sec, offset = -24) => {
  const from = await page.evaluate(() => scrollY);
  const to = await page.evaluate(([s, o]) => document.querySelector(s).getBoundingClientRect().top + scrollY + o, [sel, offset]);
  const k = sec * FPS;
  for (let i = 1; i <= k; i++) {
    await page.evaluate((y) => scrollTo(0, y), from + (to - from) * ease(i / k));
    await shot();
  }
};
const box = (sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
const typeSlow = async (sel, text) => {
  await page.focus(sel);
  for (const ch of text) {
    await page.keyboard.type(ch);
    await shot();
  }
};

// 1) Hero: The Holly turns, then Next brings The Fjord
await hold(3);
await page.click('.arrow.next');
await hold(2.5);
// 2) Adopt it: dialog, a name, into the bag
await page.click('#hero-adopt');
await hold(0.6);
await typeSlow('#adopt-pet', 'Sir Needles');
await hold(0.5);
await page.click('#adopt-form .solid');
await hold(1.6);
// 3) The four cards
await scrollTo('#trees-title', 1.4);
await hold(3.5);
// 4) Hang ornaments with different shapes and colors
await scrollTo('#decorate', 1.4, -60);
await hold(0.6);
const stage = await box('#deco-tree');
for (const [shape, color, fx, fy] of [['star', '#f2c14e', 0.5, 0.38], ['heart', '#c8232c', 0.44, 0.55], ['bell', '#f2c14e', 0.57, 0.62], ['snowflake', '#3fa4ff', 0.48, 0.72]]) {
  await page.click(`[data-shape="${shape}"]`);
  await page.click(`[data-color="${color}"]`);
  await page.mouse.move(stage.x + stage.w * fx, stage.y + stage.h * fy);
  await hold(0.35);
  await page.mouse.click(stage.x + stage.w * fx, stage.y + stage.h * fy);
  await hold(0.65);
}
await page.mouse.move(5, 5);
await hold(1);
// 5) Back to the top so the loop joins up
await scrollTo('body', 1.4, 0);
await hold(1);

await browser.close();
await server.close();
console.log(`${n} frames (${(n / FPS).toFixed(1)} s)`);

// Animated WebP: lossy frames, scaled down, loops forever
mkdirSync('docs', { recursive: true });
const files = readdirSync(FRAMES).filter((f) => f.endsWith('.jpg')).sort();
const small = `${FRAMES}/small`;
mkdirSync(small, { recursive: true });
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${FRAMES}/%05d.jpg`, '-vf', `scale=${OUT_W}:-2:flags=lanczos`, '-q:v', '2', `${small}/%05d.jpg`]);
const args = ['-loop', '0', '-lossy', '-q', process.env.Q || '62', '-m', '6', '-d', String(1000 / FPS)];
for (let i = 1; i <= files.length; i++) args.push(`${small}/${String(i).padStart(5, '0')}.jpg`);
execFileSync('img2webp', [...args, '-o', 'docs/adopt.webp']);
console.log(`docs/adopt.webp  ${(statSync('docs/adopt.webp').size / 1e6).toFixed(2)} MB`);
