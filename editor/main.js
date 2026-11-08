import GUI from 'lil-gui';
import { createViewer, ChristmasTree, PRESETS, PALETTES, LIGHT_COLORS, ORNAMENT_SHAPES, exportGLB } from '../src/index.js';

// CDN address used in the embed snippet (change this if the repo moves)
const CDN = 'https://cdn.jsdelivr.net/gh/gykim80/xmas-tree-kit@v0.2.0/dist/xmas-tree.standalone.js';
const COLORS = ['#e23b3b', '#f2c14e', '#3fa4ff', '#36c27a', '#c46cff', '#ff8fc7', '#f4f4f4', '#ff7b2e', '#2fd3c8', '#b0b8c8'];
const SHAPE_LABEL = { ball: 'Ball', drop: 'Drop', star: 'Star', bell: 'Bell', heart: 'Heart', snowflake: 'Flake' };

const $ = (s) => document.querySelector(s);
const toast = (msg) => {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 2200);
};

// Tree stored in the URL hash (#t=...)
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
window.__viewer = viewer; // for the check script
let tree = viewer.tree;

// ── Controls ──
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

const gui = new GUI({ title: 'Tree' });
const setTree = (k) => (v) => tree.set({ tree: { [k]: v } });
const setDecor = (k) => (v) => tree.set({ decor: { [k]: v } });
const afterRebuild = () => {
  syncState();
  showStats();
};

gui
  .add(state, 'preset', Object.keys(PRESETS))
  .name('Preset')
  .onChange((v) => {
    tree.loadPreset(v);
    afterRebuild();
  });
gui
  .add(state, 'quality', ['low', 'medium', 'high', 'ultra'])
  .name('Quality')
  .onChange((v) => {
    tree.set({ quality: v });
    afterRebuild();
  });
gui
  .add(state, 'size', 0.5, 25, 0.1)
  .name('Height (m)')
  .onFinishChange((v) => {
    tree.set({ size: v });
    viewer.frame();
  });
gui
  .add(state, 'background', ['night', 'evening', 'day', 'transparent'])
  .name('Background')
  .onChange((v) => viewer.setBackground(v));

const fShape = gui.addFolder('Shape');
fShape.add(state, 'seed', 1, 99999, 1).name('Seed').onFinishChange((v) => (setTree('seed')(v), afterRebuild()));
fShape.add(state, 'spread', 3, 10, 0.05).name('Spread').onFinishChange((v) => (setTree('spread')(v), afterRebuild()));
fShape.add(state, 'whorls', 8, 80, 1).name('Whorls').onFinishChange((v) => (setTree('whorls')(v), afterRebuild()));
fShape.add(state, 'branchesPerWhorl', 4, 16, 1).name('Branches / whorl').onFinishChange((v) => (setTree('branchesPerWhorl')(v), afterRebuild()));
fShape.add(state, 'droop', 0, 1, 0.01).name('Droop').onFinishChange((v) => (setTree('droop')(v), afterRebuild()));
fShape.add(state, 'upturn', 0, 1.2, 0.01).name('Upturn').onFinishChange((v) => (setTree('upturn')(v), afterRebuild()));
fShape.add(state, 'twigs', 0, 1, 0.01).name('Twigs').onFinishChange((v) => (setTree('twigs')(v), afterRebuild()));
fShape.add(state, 'needles', 0.2, 1.5, 0.01).name('Needle density').onFinishChange((v) => (setTree('needles')(v), afterRebuild()));
fShape.add(state, 'needleSize', 0.6, 3, 0.01).name('Needle size').onFinishChange((v) => (setTree('needleSize')(v), afterRebuild()));
fShape.add(state, 'clearTrunk', 0.5, 6, 0.05).name('Bare trunk').onFinishChange((v) => (setTree('clearTrunk')(v), afterRebuild()));
fShape.close();

const fDecor = gui.addFolder('Decor');
fDecor.add(state, 'ornaments', 0, 1200, 1).name('Ornaments').onFinishChange((v) => (setDecor('ornaments')(v), showStats()));
fDecor.add(state, 'ornamentSize', 0.4, 2, 0.01).name('Ornament size').onFinishChange(setDecor('ornamentSize'));
fDecor.add(state, 'paletteName', Object.keys(PALETTES)).name('Palette').onChange(setDecor('palette'));
fDecor.add(state, 'lights', 0, 4000, 1).name('Lights').onFinishChange((v) => (setDecor('lights')(v), showStats()));
fDecor.add(state, 'lightName', Object.keys(LIGHT_COLORS)).name('Light color').onChange(setDecor('lightColor'));
fDecor.add(state, 'glow', 0, 6, 0.05).name('Brightness').onChange((v) => (tree.glow = v));
fDecor.add(state, 'twinkle', 0, 6, 0.05).name('Twinkle').onChange((v) => (tree.twinkle = v));
fDecor.add(state, 'garland').name('Garland').onChange(setDecor('garland'));
fDecor.addColor(state, 'garlandColor').name('Garland color').onFinishChange(setDecor('garlandColor'));
fDecor.add(state, 'beads').name('Bead string').onChange(setDecor('beads'));
fDecor.add(state, 'topper', ['star', 'none']).name('Topper').onChange(setDecor('topper'));
fDecor.addColor(state, 'topperColor').name('Star color').onFinishChange(setDecor('topperColor'));
fDecor.add(state, 'presents', 0, 60, 1).name('Presents').onFinishChange(setDecor('presents'));
fDecor.add(state, 'base', ['bed', 'skirt', 'none']).name('Base').onChange(setDecor('base'));
fDecor.addColor(state, 'skirtColor').name('Skirt color').onFinishChange(setDecor('skirtColor'));
fDecor.add(state, 'glowLights').name('Glow lights').onChange(setDecor('glowLights'));
fDecor.close();

const fLook = gui.addFolder('Snow');
fLook.add(state, 'snow', 0, 1, 0.01).name('Snow cover').onChange((v) => (tree.snow = v));
fLook.close();
if (innerWidth < 720) gui.close();

// ── Hanging ornaments ──
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
radio($('#colors'), COLORS, color, (c) => `Color ${c}`, (c) => (color = c));
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
  $('#stats').textContent = `${s.needles.toLocaleString()} needle clusters · ${s.ornaments} ornaments · ${s.lights} lights`;
  $('#count').textContent = tree.ornaments.count ? `${tree.ornaments.count} hung` : '';
}

// ── Save and export ──
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
    prompt('Copy this', text);
  }
};

$('#save').onclick = () => download(new Blob([JSON.stringify(tree.toJSON(), null, 2)], { type: 'application/json' }), 'christmas-tree.json');
$('#load').onchange = async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  try {
    tree = viewer.setTree(JSON.parse(await f.text()));
    afterRebuild();
    toast('Loaded');
  } catch (err) {
    toast('Could not read that file');
  }
  e.target.value = '';
};
$('#share').onclick = () => {
  const url = `${location.origin}${location.pathname}#t=${b64.enc(JSON.stringify(tree.toJSON()))}`;
  history.replaceState(null, '', url);
  copy(url, 'Link copied');
};
$('#embed').onclick = () => {
  const j = tree.toJSON();
  const simple = !j.tree && !j.decor && !j.ornaments.length;
  const attrs = `preset="${j.preset}" size="${j.size}" quality="${j.quality}"${j.snow != null ? ` snow="${j.snow}"` : ''}`;
  let code = `<script type="module" src="${CDN}"></script>\n<xmas-tree ${attrs} camera-controls auto-rotate snowfall style="height:480px"></xmas-tree>`;
  if (!simple) code += `\n<script type="module">\n  document.querySelector('xmas-tree').config = ${JSON.stringify(j)};\n</script>`;
  copy(code, 'Embed code copied');
};
async function glb(light) {
  toast('Building file…');
  await new Promise((r) => setTimeout(r, 30));
  let src = tree;
  if (light) {
    // Game version: regrow at low quality and drop the point lights
    src = ChristmasTree.fromJSON(tree.toJSON(), { quality: 'low' });
    src.set({ decor: { glowLights: false } });
  }
  const buf = await exportGLB(src, { bake: true });
  if (light) src.dispose();
  download(new Blob([buf], { type: 'model/gltf-binary' }), light ? 'christmas-tree-game.glb' : 'christmas-tree.glb');
  toast(`Downloaded GLB (${(buf.byteLength / 1048576).toFixed(1)} MB)`);
}
$('#glb-light').onclick = () => glb(true);
$('#glb').onclick = () => glb(false);
$('#png').onclick = async () => download(await viewer.toBlob(), 'christmas-tree.png');

syncState();
showStats();
