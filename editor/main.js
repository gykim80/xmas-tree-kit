import GUI from 'lil-gui';
import { createViewer, ChristmasTree, PRESETS, PALETTES, LIGHT_COLORS, ORNAMENT_SHAPES, exportGLB } from '../src/index.js';

// 넣기 코드에 쓰는 주소 (저장소를 옮기면 여기만 바꾼다)
const CDN = 'https://cdn.jsdelivr.net/gh/gykim80/xmas-tree-kit@v0.1.0/dist/xmas-tree.standalone.js';
const COLORS = ['#e23b3b', '#f2c14e', '#3fa4ff', '#36c27a', '#c46cff', '#ff8fc7', '#f4f4f4', '#ff7b2e', '#2fd3c8', '#b0b8c8'];
const SHAPE_LABEL = { ball: '구슬', drop: '물방울', star: '별', bell: '종', heart: '하트', snowflake: '눈송이' };

const $ = (s) => document.querySelector(s);
const toast = (msg) => {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 2200);
};

// 주소의 #t= 에 담긴 트리
const b64 = {
  enc: (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))),
};
function fromHash() {
  const m = location.hash.match(/t=([\w-]+)/);
  if (!m) return null;
  try {
    return JSON.parse(b64.dec(m[1]));
  } catch {
    return null;
  }
}

const start = fromHash() ?? { preset: 'classic', size: 2.4, quality: 'high' };
const viewer = createViewer($('#stage'), { background: 'night', autoRotate: true, snowfall: true, json: start.format ? start : undefined, ...(start.format ? {} : start) });
window.__viewer = viewer; // 점검 스크립트용
let tree = viewer.tree;

// ── 조절판 ──
const state = {};
function fillState() {
  const r = tree.resolved;
  Object.assign(state, {
    preset: tree.options.preset,
    quality: tree.options.quality,
    size: tree.options.size,
    background: state.background ?? 'night',
    ...r.tree,
    ...r.decor,
    paletteName: Array.isArray(r.decor.palette) ? 'classic' : r.decor.palette,
    lightName: Array.isArray(r.decor.lightColor) ? 'warm' : r.decor.lightColor,
    snow: r.snow,
    glow: r.glow,
    twinkle: r.twinkle,
  });
}
function syncState() {
  fillState();
  gui.controllersRecursive().forEach((c) => c.updateDisplay());
}
fillState();

const gui = new GUI({ title: '트리' });
const setTree = (k) => (v) => tree.set({ tree: { [k]: v } });
const setDecor = (k) => (v) => tree.set({ decor: { [k]: v } });
const afterRebuild = () => {
  syncState();
  showStats();
};

gui
  .add(state, 'preset', Object.keys(PRESETS))
  .name('프리셋')
  .onChange((v) => {
    tree.loadPreset(v);
    afterRebuild();
  });
gui
  .add(state, 'quality', ['low', 'medium', 'high', 'ultra'])
  .name('품질')
  .onChange((v) => {
    tree.set({ quality: v });
    afterRebuild();
  });
gui
  .add(state, 'size', 0.5, 25, 0.1)
  .name('높이 (m)')
  .onFinishChange((v) => {
    tree.set({ size: v });
    viewer.frame();
  });
gui
  .add(state, 'background', ['night', 'evening', 'day', 'transparent'])
  .name('배경')
  .onChange((v) => viewer.setBackground(v));

const fShape = gui.addFolder('나무 형태');
fShape.add(state, 'seed', 1, 99999, 1).name('씨앗값').onFinishChange((v) => (setTree('seed')(v), afterRebuild()));
fShape.add(state, 'spread', 3, 10, 0.05).name('가지 폭').onFinishChange((v) => (setTree('spread')(v), afterRebuild()));
fShape.add(state, 'whorls', 8, 80, 1).name('가지 층').onFinishChange((v) => (setTree('whorls')(v), afterRebuild()));
fShape.add(state, 'branchesPerWhorl', 4, 16, 1).name('층마다 가지').onFinishChange((v) => (setTree('branchesPerWhorl')(v), afterRebuild()));
fShape.add(state, 'droop', 0, 1, 0.01).name('처짐').onFinishChange((v) => (setTree('droop')(v), afterRebuild()));
fShape.add(state, 'upturn', 0, 1.2, 0.01).name('끝 들림').onFinishChange((v) => (setTree('upturn')(v), afterRebuild()));
fShape.add(state, 'twigs', 0, 1, 0.01).name('잔가지').onFinishChange((v) => (setTree('twigs')(v), afterRebuild()));
fShape.add(state, 'needles', 0.2, 1.5, 0.01).name('잎 밀도').onFinishChange((v) => (setTree('needles')(v), afterRebuild()));
fShape.add(state, 'needleSize', 0.6, 3, 0.01).name('잎 크기').onFinishChange((v) => (setTree('needleSize')(v), afterRebuild()));
fShape.add(state, 'clearTrunk', 0.5, 6, 0.05).name('드러난 밑동').onFinishChange((v) => (setTree('clearTrunk')(v), afterRebuild()));
fShape.close();

const fDecor = gui.addFolder('장식');
fDecor.add(state, 'ornaments', 0, 1200, 1).name('오너먼트 수').onFinishChange((v) => (setDecor('ornaments')(v), showStats()));
fDecor.add(state, 'ornamentSize', 0.4, 2, 0.01).name('오너먼트 크기').onFinishChange(setDecor('ornamentSize'));
fDecor.add(state, 'paletteName', Object.keys(PALETTES)).name('오너먼트 색').onChange(setDecor('palette'));
fDecor.add(state, 'lights', 0, 4000, 1).name('전구 수').onFinishChange((v) => (setDecor('lights')(v), showStats()));
fDecor.add(state, 'lightName', Object.keys(LIGHT_COLORS)).name('전구 색').onChange(setDecor('lightColor'));
fDecor.add(state, 'glow', 0, 6, 0.05).name('전구 밝기').onChange((v) => (tree.glow = v));
fDecor.add(state, 'twinkle', 0, 6, 0.05).name('깜박임').onChange((v) => (tree.twinkle = v));
fDecor.add(state, 'garland').name('금박 갈런드').onChange(setDecor('garland'));
fDecor.addColor(state, 'garlandColor').name('갈런드 색').onFinishChange(setDecor('garlandColor'));
fDecor.add(state, 'beads').name('구슬 줄').onChange(setDecor('beads'));
fDecor.add(state, 'topper', ['star', 'none']).name('꼭대기').onChange(setDecor('topper'));
fDecor.addColor(state, 'topperColor').name('별 색').onFinishChange(setDecor('topperColor'));
fDecor.add(state, 'presents', 0, 60, 1).name('선물 상자').onFinishChange(setDecor('presents'));
fDecor.add(state, 'base', ['bed', 'skirt', 'none']).name('밑동 둘레').onChange(setDecor('base'));
fDecor.addColor(state, 'skirtColor').name('치마 색').onFinishChange(setDecor('skirtColor'));
fDecor.add(state, 'glowLights').name('점광원').onChange(setDecor('glowLights'));
fDecor.close();

const fLook = gui.addFolder('눈');
fLook.add(state, 'snow', 0, 1, 0.01).name('쌓인 눈').onChange((v) => (tree.snow = v));
fLook.close();
if (innerWidth < 720) gui.close();

// ── 오너먼트 달기 ──
let mode = 'view';
let shape = 'ball';
let color = COLORS[0];
function radio(container, items, current, label, onPick) {
  container.innerHTML = '';
  for (const it of items) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(it === current));
    b.setAttribute('aria-label', label(it));
    b.title = label(it);
    if (container.id === 'colors') b.style.background = it;
    else b.textContent = label(it);
    b.onclick = () => {
      container.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
      onPick(it);
    };
    container.append(b);
  }
}
radio($('#shapes'), ORNAMENT_SHAPES, shape, (s) => SHAPE_LABEL[s], (s) => (shape = s));
radio($('#colors'), COLORS, color, (c) => `색 ${c}`, (c) => (color = c));
document.querySelectorAll('[data-mode]').forEach((b) => {
  b.onclick = () => {
    mode = b.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    $('#stage').className = mode;
    tree.ornaments.preview(null);
    viewer.controls.autoRotate = mode === 'view';
    viewer.autoRotate = mode === 'view';
  };
});

const canvas = viewer.renderer.domElement;
let down = null;
canvas.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
canvas.addEventListener('pointermove', (e) => {
  const ndc = viewer.ndc(e.clientX, e.clientY);
  if (mode === 'add') tree.ornaments.preview(tree.surfacePoint(ndc, viewer.camera), shape, color);
  if (mode === 'remove') tree.ornaments.highlight(tree.pickOrnament(ndc, viewer.camera));
});
canvas.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
  const ndc = viewer.ndc(e.clientX, e.clientY);
  if (mode === 'add') {
    const spot = tree.surfacePoint(ndc, viewer.camera);
    if (spot) tree.addOrnament({ shape, color, h: spot.h, a: spot.a });
  } else if (mode === 'remove') {
    const hit = tree.pickOrnament(ndc, viewer.camera);
    if (hit) tree.removeOrnament(hit.id);
  }
  showStats();
});

function showStats() {
  const s = tree.stats;
  $('#stats').textContent = `잎 ${s.needles.toLocaleString()} · 오너먼트 ${s.ornaments} · 전구 ${s.lights}`;
  $('#count').textContent = tree.ornaments.count ? `단 오너먼트 ${tree.ornaments.count}개` : '';
}

// ── 저장과 내보내기 ──
const download = (blob, name) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};
const copy = async (text, msg) => {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    prompt('복사해서 쓰세요', text);
  }
};

$('#save').onclick = () => download(new Blob([JSON.stringify(tree.toJSON(), null, 2)], { type: 'application/json' }), 'christmas-tree.json');
$('#load').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    tree = viewer.setTree(JSON.parse(await f.text()));
    afterRebuild();
    toast('불러왔습니다');
  } catch (err) {
    toast('읽을 수 없는 파일입니다');
  }
  e.target.value = '';
};
$('#share').onclick = () => {
  const url = `${location.origin}${location.pathname}#t=${b64.enc(JSON.stringify(tree.toJSON()))}`;
  history.replaceState(null, '', url);
  copy(url, '링크를 복사했습니다');
};
$('#embed').onclick = () => {
  const j = tree.toJSON();
  const simple = !j.tree && !j.decor && !j.ornaments.length;
  const attrs = `preset="${j.preset}" size="${j.size}" quality="${j.quality}"${j.snow != null ? ` snow="${j.snow}"` : ''}`;
  let code = `<script type="module" src="${CDN}"></script>\n<xmas-tree ${attrs} camera-controls auto-rotate snowfall style="height:480px"></xmas-tree>`;
  if (!simple) code += `\n<script type="module">\n  document.querySelector('xmas-tree').config = ${JSON.stringify(j)};\n</script>`;
  copy(code, '넣기 코드를 복사했습니다');
};
async function glb(light) {
  toast('파일을 만드는 중입니다');
  await new Promise((r) => setTimeout(r, 30));
  let src = tree;
  if (light) {
    // 게임용: 낮은 품질로 다시 키우고 점광원은 뺀다
    src = ChristmasTree.fromJSON(tree.toJSON(), { quality: 'low' });
    src.set({ decor: { glowLights: false } });
  }
  const buf = await exportGLB(src, { bake: true });
  if (light) src.dispose();
  download(new Blob([buf], { type: 'model/gltf-binary' }), light ? 'christmas-tree-game.glb' : 'christmas-tree.glb');
  toast(`GLB ${(buf.byteLength / 1048576).toFixed(1)}MB 를 내려받았습니다`);
}
$('#glb-light').onclick = () => glb(true);
$('#glb').onclick = () => glb(false);
$('#png').onclick = async () => download(await viewer.toBlob(), 'christmas-tree.png');

syncState();
showStats();
