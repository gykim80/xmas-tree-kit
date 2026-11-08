// Headless browser check: screenshots each page and verifies console errors, ornament hanging and GLB export
// node scripts/check.mjs  (starts its own dev server; screenshots go to tmp/shots/)
import { chromium } from 'playwright';
import { createServer } from 'vite';
import { mkdirSync } from 'node:fs';

mkdirSync('tmp/shots', { recursive: true });
const server = await createServer({ configFile: 'vite.site.config.js', server: { port: 5321, open: false } });
await server.listen();
const base = 'http://localhost:5321';
const browser = await chromium.launch({ args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const results = [];
let failed = 0;
const ok = (name, cond, info = '') => {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${info ? `  (${info})` : ''}`);
  if (!cond) failed++;
};

async function open(path, { w = 1280, h = 800 } = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(base + path);
  return { page, errors };
}

// 1) Editor
{
  const { page, errors } = await open('/editor/');
  await page.waitForFunction(() => window.__viewer?.tree, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tmp/shots/editor.png' });
  await page.click('[data-mode="add"]');
  const before = await page.evaluate(() => window.__viewer.tree.ornaments.count);
  for (const [x, y] of [[640, 380], [600, 450], [680, 300]]) await page.mouse.click(x, y);
  await page.waitForTimeout(800);
  const after = await page.evaluate(() => window.__viewer.tree.ornaments.count);
  ok('editor: click to hang ornaments', after === before + 3, `${before} → ${after}`);
  await page.screenshot({ path: 'tmp/shots/editor-ornaments.png' });
  // Remove
  await page.click('[data-mode="remove"]');
  const pos = await page.evaluate(() => {
    const v = window.__viewer;
    const o = v.tree.ornaments.list()[0];
    const p = v.tree.ornamentPosition(o).project(v.camera);
    const r = v.renderer.domElement.getBoundingClientRect();
    return [((p.x + 1) / 2) * r.width, ((1 - p.y) / 2) * r.height];
  });
  await page.mouse.click(pos[0], pos[1]);
  const afterRemove = await page.evaluate(() => window.__viewer.tree.ornaments.count);
  ok('editor: click to remove', afterRemove === after - 1, `${after} → ${afterRemove}`);
  // Change preset -> hung ornaments kept
  const kept = await page.evaluate(() => {
    const t = window.__viewer.tree;
    t.loadPreset('nordic');
    return t.ornaments.count;
  });
  ok('editor: hung ornaments survive a preset change', kept === afterRemove);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tmp/shots/editor-nordic.png' });
  // GLB export -> reload
  const glb = await page.evaluate(async () => (await import('/test/browser-probe.js')).probeGLB(window.__viewer.tree));
  ok('editor: GLB export (baked) and reload', glb.meshes > 5 && glb.height > 2 && glb.height < 3, `${(glb.baked / 1e6).toFixed(1)}MB, meshes ${glb.meshes}, height ${glb.height.toFixed(2)}m`);
  ok('editor: instanced GLB is smaller', glb.inst < glb.baked, `${(glb.inst / 1e6).toFixed(2)}MB`);
  // Share link -> same tree
  const same = await page.evaluate(() => JSON.stringify(window.__viewer.tree.toJSON()));
  await page.click('#share').catch(() => {});
  const url = page.url();
  const p2 = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await p2.goto(url);
  await p2.waitForFunction(() => window.__viewer?.tree, null, { timeout: 30000 });
  const restored = await p2.evaluate(() => JSON.stringify(window.__viewer.tree.toJSON()));
  ok('editor: share link restores the same tree', restored === same && url.includes('#t='));
  await p2.close();
  ok('editor: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// 2) Web component
{
  const { page, errors } = await open('/examples/embed.html', { w: 1200, h: 1400 });
  await page.waitForFunction(() => [...document.querySelectorAll('xmas-tree')].every((e) => e.tree), null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tmp/shots/embed.png', fullPage: true });
  const n = await page.evaluate(() => document.querySelectorAll('xmas-tree').length);
  ok('embed: all 4 <xmas-tree> elements load', n === 4);
  const wall = await page.$('#wall');
  await wall.scrollIntoViewIfNeeded();
  const box = await wall.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
  await page.waitForTimeout(400);
  const log = await page.textContent('#log');
  ok('embed: decorate hangs an ornament and fires ornamentadd', /hung: 1\b/.test(log), log);
  // Attribute changes apply immediately
  const changed = await page.evaluate(async () => {
    const el = document.querySelector('xmas-tree');
    el.setAttribute('snow', '1');
    el.setAttribute('palette', 'candy');
    return { snow: el.tree.snow, palette: el.tree.resolved.decor.palette };
  });
  ok('embed: attribute changes apply', changed.snow === 1 && changed.palette === 'candy');
  ok('embed: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// 3) Own-scene example
{
  const { page, errors } = await open('/examples/basic.html');
  await page.waitForFunction(() => window.__trees, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tmp/shots/basic.png' });
  const n = await page.evaluate(() => window.__trees[0].ornaments.count);
  ok('basic: three trees and 12 stars', n === 12);
  ok('basic: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// 4) Game example
{
  const { page, errors } = await open('/examples/game.html');
  await page.waitForFunction(() => window.__game, null, { timeout: 40000 });
  await page.waitForTimeout(800);
  // Walk up to the tree and hang one
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1300);
  await page.keyboard.up('KeyW');
  await page.mouse.click(640, 400);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'tmp/shots/game.png' });
  const g = await page.evaluate(() => ({ n: window.__game.main.ornaments.count, z: window.__game.player.z }));
  ok('game: walk up and hang an ornament', g.n === 2, `hung ${g.n}, z=${g.z.toFixed(2)}`);
  // Can't walk through the trunk
  await page.evaluate(() => window.__game.player.set(0, 1.65, 3));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1600);
  await page.keyboard.up('KeyW');
  const z = await page.evaluate(() => Math.hypot(window.__game.player.x, window.__game.player.z));
  ok('game: trunk collision', z >= 0.55, `distance to center ${z.toFixed(2)}m`);
  ok('game: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// 5) Landing page + mobile width
{
  const { page, errors } = await open('/', { w: 390, h: 844 });
  await page.waitForFunction(() => document.querySelector('xmas-tree')?.tree, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tmp/shots/index-mobile.png' });
  const { page: ed } = await open('/editor/', { w: 390, h: 844 });
  await ed.waitForFunction(() => window.__viewer?.tree, null, { timeout: 30000 });
  await ed.waitForTimeout(1200);
  await ed.screenshot({ path: 'tmp/shots/editor-mobile.png' });
  ok('index: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
  await ed.close();
}

// 6) Sample shop (tree adoption site)
{
  const { page, errors } = await open('/examples/adopt/', { w: 1440, h: 900 });
  await page.waitForFunction(() => [...document.querySelectorAll('xmas-tree')].every((e) => e.tree), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tmp/shots/adopt.png' });
  const n = await page.evaluate(() => document.querySelectorAll('xmas-tree').length);
  ok('adopt: hero, 4 cards and the decorate tree load', n === 6);
  await page.click('.arrow.next');
  await page.waitForTimeout(400);
  const next = await page.evaluate(() => ({ name: document.querySelector('#hero-name').textContent, preset: document.querySelector('#hero-tree').tree.toJSON().preset }));
  ok('adopt: Next swaps the hero tree', next.name === 'The Fjord' && next.preset === 'nordic', `${next.name}, ${next.preset}`);
  await page.click('#hero-adopt');
  await page.fill('#adopt-pet', 'Sir Needles');
  await page.click('#adopt-form .solid');
  await page.waitForFunction(() => document.querySelector('#bag-count').textContent === '1', null, { timeout: 3000 }).catch(() => {});
  const bag = await page.textContent('#bag-count');
  ok('adopt: adopting adds to the bag', bag === '1', `bag ${bag}`);
  const deco = await page.$('#deco-tree');
  await deco.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  const before = Number(await page.textContent('#hung-count'));
  await page.click('[data-shape="star"]');
  const box = await deco.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
  await page.waitForTimeout(400);
  const after = Number(await page.textContent('#hung-count'));
  ok('adopt: clicking the tree hangs an ornament', after === before + 1, `${before} → ${after}`);
  ok('adopt: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

await browser.close();
await server.close();
console.log(results.join('\n'));
console.log(failed ? `\n${failed} failed` : '\nall passed');
process.exit(failed ? 1 : 0);
