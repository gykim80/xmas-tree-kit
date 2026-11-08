// 헤드리스 브라우저 점검: 페이지마다 화면을 찍고, 콘솔 오류·오너먼트 달기·GLB 내보내기를 확인한다
// node scripts/check.mjs  (개발 서버를 스스로 띄운다. tmp/shots/ 에 스크린샷)
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

// 1) 에디터
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
  ok('editor: 눌러서 오너먼트 달기', after === before + 3, `${before} → ${after}`);
  await page.screenshot({ path: 'tmp/shots/editor-ornaments.png' });
  // 떼기
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
  ok('editor: 눌러서 떼기', afterRemove === after - 1, `${after} → ${afterRemove}`);
  // 프리셋 바꾸기 → 단 오너먼트 유지
  const kept = await page.evaluate(() => {
    const t = window.__viewer.tree;
    t.loadPreset('nordic');
    return t.ornaments.count;
  });
  ok('editor: 프리셋을 바꿔도 단 오너먼트 유지', kept === afterRemove);
  await page.waitForTimeout(600);
  await page.screenshot({ path: 'tmp/shots/editor-nordic.png' });
  // GLB 내보내기 → 다시 읽기
  const glb = await page.evaluate(async () => (await import('/test/browser-probe.js')).probeGLB(window.__viewer.tree));
  ok('editor: GLB 내보내기(구움) 후 다시 읽기', glb.meshes > 5 && glb.height > 2 && glb.height < 3, `${(glb.baked / 1e6).toFixed(1)}MB, 메시 ${glb.meshes}, 높이 ${glb.height.toFixed(2)}m`);
  ok('editor: GLB 인스턴싱판이 더 작다', glb.inst < glb.baked, `${(glb.inst / 1e6).toFixed(2)}MB`);
  // 공유 링크 → 같은 트리
  const same = await page.evaluate(() => JSON.stringify(window.__viewer.tree.toJSON()));
  await page.click('#share').catch(() => {});
  const url = page.url();
  const p2 = await browser.newPage({ viewport: { width: 900, height: 700 } });
  await p2.goto(url);
  await p2.waitForFunction(() => window.__viewer?.tree, null, { timeout: 30000 });
  const restored = await p2.evaluate(() => JSON.stringify(window.__viewer.tree.toJSON()));
  ok('editor: 공유 링크로 같은 트리 복원', restored === same && url.includes('#t='));
  await p2.close();
  ok('editor: 콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// 2) 웹 컴포넌트
{
  const { page, errors } = await open('/examples/embed.html', { w: 1200, h: 1400 });
  await page.waitForFunction(() => [...document.querySelectorAll('xmas-tree')].every((e) => e.tree), null, { timeout: 40000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tmp/shots/embed.png', fullPage: true });
  const n = await page.evaluate(() => document.querySelectorAll('xmas-tree').length);
  ok('embed: <xmas-tree> 4개 모두 뜸', n === 4);
  const wall = await page.$('#wall');
  await wall.scrollIntoViewIfNeeded();
  const box = await wall.boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.5);
  await page.waitForTimeout(400);
  const log = await page.textContent('#log');
  ok('embed: decorate 로 달기와 ornamentadd 이벤트', /1개/.test(log), log);
  // 속성 바꾸면 바로 반영
  const changed = await page.evaluate(async () => {
    const el = document.querySelector('xmas-tree');
    el.setAttribute('snow', '1');
    el.setAttribute('palette', 'candy');
    return { snow: el.tree.snow, palette: el.tree.resolved.decor.palette };
  });
  ok('embed: 속성 변경 반영', changed.snow === 1 && changed.palette === 'candy');
  ok('embed: 콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// 3) 내 장면 예제
{
  const { page, errors } = await open('/examples/basic.html');
  await page.waitForFunction(() => window.__trees, null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'tmp/shots/basic.png' });
  const n = await page.evaluate(() => window.__trees[0].ornaments.count);
  ok('basic: 트리 세 그루와 별 12개', n === 12);
  ok('basic: 콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// 4) 게임 예제
{
  const { page, errors } = await open('/examples/game.html');
  await page.waitForFunction(() => window.__game, null, { timeout: 40000 });
  await page.waitForTimeout(800);
  // 트리 앞으로 걸어가 단다
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1300);
  await page.keyboard.up('KeyW');
  await page.mouse.click(640, 400);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(2600);
  await page.screenshot({ path: 'tmp/shots/game.png' });
  const g = await page.evaluate(() => ({ n: window.__game.main.ornaments.count, z: window.__game.player.z }));
  ok('game: 걸어가서 오너먼트 달기', g.n === 2, `단 개수 ${g.n}, z=${g.z.toFixed(2)}`);
  // 줄기를 뚫고 지나가지 못한다
  await page.evaluate(() => window.__game.player.set(0, 1.65, 3));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1600);
  await page.keyboard.up('KeyW');
  const z = await page.evaluate(() => Math.hypot(window.__game.player.x, window.__game.player.z));
  ok('game: 줄기 충돌', z >= 0.55, `중심까지 ${z.toFixed(2)}m`);
  ok('game: 콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
}

// 5) 첫 화면 + 모바일 폭
{
  const { page, errors } = await open('/', { w: 390, h: 844 });
  await page.waitForFunction(() => document.querySelector('xmas-tree')?.tree, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'tmp/shots/index-mobile.png' });
  const { page: ed } = await open('/editor/', { w: 390, h: 844 });
  await ed.waitForFunction(() => window.__viewer?.tree, null, { timeout: 30000 });
  await ed.waitForTimeout(1200);
  await ed.screenshot({ path: 'tmp/shots/editor-mobile.png' });
  ok('index: 콘솔 오류 없음', errors.length === 0, errors.slice(0, 3).join(' | '));
  await page.close();
  await ed.close();
}

await browser.close();
await server.close();
console.log(results.join('\n'));
console.log(failed ? `\n${failed}개 실패` : '\n모두 통과');
process.exit(failed ? 1 : 0);
