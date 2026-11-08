// Vertical promo (1080×1920, 30 fps, 120 BPM, 48 beats = 24 s).
// Every beat is a cut. Frames are a pure function of time, so promo/render.mjs can
// capture them one by one. Open /promo/ in the dev server to preview in real time.
import * as THREE from 'three';
import { createViewer } from '../src/index.js';
import { mulberry32 } from '../src/core/rng.js';

const FPS = 30;
const BPM = 120;
const BEAT = 60 / BPM;
const BEATS = 48;
const DURATION = BEATS * BEAT;
const RENDER = new URLSearchParams(location.search).has('render');

const $ = (id) => document.getElementById(id);
const frameEl = $('frame');
if (!RENDER) {
  const fit = () => (frameEl.style.transform = `scale(${Math.min(innerWidth / 1080, innerHeight / 1920)})`);
  fit();
  addEventListener('resize', fit);
}

const viewer = createViewer($('stage'), {
  background: 'night',
  controls: false,
  autoRotate: false,
  snowfall: true,
  pixelRatio: 1,
  preset: 'bare',
  quality: 'high',
  size: 2.4,
  ornamentScale: 3,
});
viewer.pause();
const { renderer, scene, camera } = viewer;
const tree = viewer.tree;
const snowfall = () => scene.getObjectByName('snowfall');

// Growth wipe: everything above the plane is clipped, plus a glowing scan ring at the cut
const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
renderer.clippingPlanes = [clip];
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.96, 1, 96),
  new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false, clippingPlanes: [] })
);
ring.rotation.x = -Math.PI / 2;
ring.renderOrder = 10;
scene.add(ring);

// ── Timeline ──────────────────────────────────────────────
const SEEDS = [
  { seed: 412, spread: 6.2, droop: 0.41, upturn: 0.5 },
  { seed: 1225, spread: 7.0, droop: 0.36, upturn: 0.55 },
  { seed: 77, spread: 7.8, droop: 0.22, upturn: 0.7 },
  { seed: 909, spread: 5.0, droop: 0.55, upturn: 0.35 },
  { seed: 2024, spread: 6.8, droop: 0.3, upturn: 0.9 },
  { seed: 5, spread: 8.4, droop: 0.48, upturn: 0.45 },
  { seed: 314, spread: 5.6, droop: 0.62, upturn: 0.3 },
  { seed: 1414, spread: 7.4, droop: 0.18, upturn: 0.8 },
];
const PRESET_ORDER = [
  ['classic', 'night'],
  ['cozy', 'evening'],
  ['nordic', 'day'],
  ['rainbow', 'night'],
  ['candy', 'evening'],
  ['snowy', 'day'],
  ['bare', 'night'],
  ['classic', 'night'],
];
const NO_DECOR = { ornaments: 0, lights: 0, garland: false, beads: false, presents: 0, topper: 'none', glowLights: false, base: 'bed' };

const code = (...segs) => segs; // [cls, text] pairs
const SHIP_CARDS = [
  code(['c', '<!-- any web page -->\n'], ['', '<'], ['k', 'xmas-tree'], ['', ' preset='], ['s', '"cozy"'], ['', '\n  snowfall camera-controls>'], ['', '\n</'], ['k', 'xmas-tree'], ['', '>']),
  code(['c', '// your three.js game\n'], ['k', 'const'], ['', ' tree = '], ['k', 'new'], ['', ' ChristmasTree({\n  preset: '], ['s', "'classic'"], ['', ', size: 6 })\nscene.add(tree)']),
  code(['c', '// any engine\n'], ['k', 'await'], ['', ' exportGLB(tree)\n'], ['s', '→ Unity · Godot · Unreal']),
  code(['c', '# install from git\n'], ['k', 'npm i'], ['', ' github:gykim80/\n      xmas-tree-kit']),
];

// What each beat looks like. Tree specs are absolute so any beat can be rendered on its own.
function spec(b) {
  if (b < 4) {
    const lines = ['XMAS', 'XMAS\nTREE', 'XMAS\nTREE\nKIT', 'XMAS\nTREE\nKIT'];
    return { key: 'intro', preset: 'classic', decor: {}, mood: 'night', snow: 0.5, grow: b === 0 ? 1.9 : 0, title: lines[b], kicker: b === 3 ? 'GROW · DECORATE · SHIP' : '', snowfall: true, cam: 6.6, camY: 0.55 };
  }
  if (b < 12) {
    const s = SEEDS[b - 4];
    return {
      key: `seed-${b}`, preset: 'bare', tree: s, decor: NO_DECOR, mood: 'day', snow: 0.35, grow: 0.32, cut: true,
      kicker: 'ONE SEED · ONE TREE', label: String(s.seed).padStart(4, '0'), meta: `spread ${s.spread.toFixed(1)} · droop ${s.droop.toFixed(2)}`,
    };
  }
  if (b < 20) {
    const [p, mood] = PRESET_ORDER[b - 12];
    return { key: `preset-${b}`, preset: p, decor: {}, mood, grow: 0.26, cut: true, kicker: '7 PRESETS', label: p, meta: `preset="${p}"`, snowfall: mood !== 'day' };
  }
  if (b < 28) {
    return { key: 'hang', preset: 'classic', decor: { ornaments: 40 }, mood: 'night', snow: 0.4, cut: b === 20, kicker: 'HANG ORNAMENTS', hang: true, snowfall: true, cam: 4.9 };
  }
  if (b < 36) {
    const step = Math.floor((b - 28) / 2); // 0 lights, 1 garland, 2 star, 3 snow
    const decor = { ...NO_DECOR, ornaments: 40, lights: 1900, glowLights: true };
    if (step >= 1) Object.assign(decor, { garland: true, beads: true });
    if (step >= 2) Object.assign(decor, { topper: 'star', presents: 26 });
    const labels = [['LIGHTS', 'lights: 1900'], ['GARLAND', "garland: true"], ['STAR', "topper: 'star'"], ['SNOW', 'snow: 1.0']];
    return { key: `dress-${step}`, preset: 'classic', decor, mood: 'night', snow: step === 3 ? 'ramp' : 0, cut: b % 2 === 0, kicker: 'DRESS IT UP', label: labels[step][0], meta: labels[step][1], snowfall: step === 3 };
  }
  if (b < 44) {
    const card = Math.floor((b - 36) / 2);
    return { key: 'ship', preset: 'cozy', decor: {}, mood: 'evening', cut: b % 2 === 0, kicker: 'DROP IT ANYWHERE', card, cardStart: 36 + card * 2, snowfall: true, cam: 6.2, camY: 0.2 };
  }
  return { key: 'outro', preset: 'classic', decor: {}, mood: 'night', snow: 0.5, grow: b === 44 ? 0.9 : 0, cut: b === 44, title: 'XMAS\nTREE\nKIT', kicker: 'OPEN SOURCE · MIT', meta: 'github.com/gykim80/xmas-tree-kit', snowfall: true, cam: 6.6, camY: 0.55 };
}

// Ornament hits during the HANG section: 3 per half beat, facing the camera
const HANG_COLORS = ['#e23b3b', '#f2c14e', '#3fa4ff', '#36c27a', '#c46cff', '#ff8fc7', '#f4f4f4', '#ff7b2e'];
const SHAPES = ['ball', 'star', 'bell', 'heart', 'snowflake', 'drop'];
const hangEvents = [];
{
  const rand = mulberry32(99);
  let n = 0;
  for (let b = 20; b < 28; b++) {
    for (let half = 0; half < 2; half++) {
      const t = (b + half * 0.5) * BEAT;
      for (let k = 0; k < 3; k++) {
        hangEvents.push({ t, h: 0.2 + rand() * 0.66, off: (rand() - 0.5) * 1.9, shape: SHAPES[n % SHAPES.length], color: HANG_COLORS[n % HANG_COLORS.length] });
        n++;
      }
    }
  }
}

// ── Applying state ────────────────────────────────────────
let applied = '';
let mood = '';
let hangDone = 0;
let lastT = -1;

function applyTree(s) {
  const want = JSON.stringify([s.preset, s.tree ?? {}, s.decor]);
  if (want === applied) return false;
  applied = want;
  tree.options.preset = s.preset;
  tree.options.tree = { ...(s.tree ?? {}) };
  tree.options.decor = { ...s.decor };
  tree.generate();
  return true;
}

function camAngle(t) {
  return 0.9 + t * 0.32;
}

// Render-time typing: show the first n characters across highlighted segments
function typed(segs, n) {
  let html = '';
  for (const [cls, text] of segs) {
    if (n <= 0) break;
    const part = text.slice(0, n).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    n -= text.length;
    html += cls ? `<span class="${cls}">${part}</span>` : part;
  }
  return html;
}

const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

function frameAt(t) {
  t = Math.min(t, DURATION - 1e-4);
  const b = Math.floor(t / BEAT);
  const tb = t - b * BEAT; // time since this beat
  const s = spec(b);

  // Going back in time (preview loop): start over
  if (t < lastT) {
    tree.ornaments.clear();
    hangDone = 0;
  }
  lastT = t;

  const regrown = applyTree(s);
  if (s.mood !== mood) viewer.setBackground((mood = s.mood));
  tree.update(t);

  // Snow cover
  const snow = s.snow === 'ramp' ? ease((t - 34 * BEAT) / (BEAT * 1.2)) : (s.snow ?? tree.resolved.snow);
  tree.uniforms.uSnow.value = snow;

  // Ornaments: hang on schedule, clear them when we leave the decorated sections
  if (b < 20) {
    if (tree.ornaments.count) tree.ornaments.clear();
    hangDone = 0;
  }
  while (hangDone < hangEvents.length && hangEvents[hangDone].t <= t) {
    const e = hangEvents[hangDone++];
    tree.addOrnament({ shape: e.shape, color: e.color, h: e.h, a: camAngle(e.t) + e.off });
  }
  if (b >= 36 && tree.ornaments.count) tree.ornaments.clear();

  // Camera: slow orbit, a punch-in on every beat
  const punch = Math.exp(-tb * 9);
  const dist = (s.cam ?? 5.4) * (1 - 0.045 * punch);
  const a = camAngle(t);
  const ty = 1.2 + (s.camY ?? 0);
  camera.fov = 40;
  camera.aspect = 1080 / 1920;
  camera.position.set(Math.cos(a) * dist, ty + 0.55, Math.sin(a) * dist);
  camera.lookAt(0, ty, 0);
  camera.updateProjectionMatrix();

  // Growth wipe
  const growStart = s.key === 'intro' ? 0 : s.key === 'outro' ? 44 * BEAT : b * BEAT;
  const gp = s.grow ? ease((t - growStart) / s.grow) : 1;
  const H = 3.1;
  clip.constant = gp < 1 ? 0.01 + gp * H : 100;
  ring.visible = gp < 1;
  if (ring.visible) {
    const y = clip.constant;
    const r = Math.max(0.15, tree.footprint.crownRadius * 1.15 * (1 - (y / H) * 0.9));
    ring.position.y = y - 0.005;
    ring.scale.setScalar(r);
    ring.material.opacity = 0.9 * (1 - gp);
  }

  // Snowfall
  const sf = snowfall();
  if (sf) {
    sf.visible = !!s.snowfall;
    sf.userData.step(1 / FPS, t);
  }

  // ── Text layers ──
  const slam = 1 + 0.32 * Math.exp(-tb * 16);
  const fade = Math.min(1, tb * 18);
  $('kicker').textContent = s.kicker ?? '';
  $('kicker').style.opacity = s.kicker ? 1 : 0;

  $('title').innerText = s.title ?? '';
  $('title').style.transform = `scale(${s.key === 'intro' && b < 3 ? slam : s.key === 'outro' && b === 44 ? slam : 1})`;

  $('label').textContent = s.label ?? '';
  $('label').style.fontSize = (s.label?.length ?? 0) > 6 ? '84px' : '110px';
  $('label').style.transform = `scale(${slam}) translateY(${(1 - fade) * 30}px)`;
  $('label').style.opacity = s.label ? fade : 0;

  let meta = s.meta ?? '';
  if (s.hang) {
    const n = tree.ornaments.count;
    $('label').textContent = `×${n}`;
    $('label').style.opacity = 1;
    const last = hangEvents[Math.max(0, hangDone - 1)];
    meta = `addOrnament({ shape: '${last.shape}' })`;
    // half-beat slam
    const th = t % (BEAT / 2);
    $('label').style.transform = `scale(${1 + 0.28 * Math.exp(-th * 18)})`;
    $('label').style.fontSize = '120px';
  }
  $('meta').textContent = meta;
  $('meta').style.opacity = meta ? 1 : 0;
  $('meta').style.fontSize = meta.length > 30 ? '36px' : '46px';

  const codeEl = $('code');
  if (s.card != null) {
    const segs = SHIP_CARDS[s.card];
    const total = segs.reduce((n, [, x]) => n + x.length, 0);
    const p = (t - s.cardStart * BEAT) / (BEAT * 0.75);
    codeEl.innerHTML = typed(segs, Math.ceil(ease(p) * total)) + (p < 1.6 && Math.floor(t * 4) % 2 === 0 ? '▍' : '');
    codeEl.style.opacity = 1;
    codeEl.style.transform = `translateY(${(1 - ease(p * 3)) * 60}px) scale(${1 + 0.04 * Math.exp(-tb * 14)})`;
  } else {
    codeEl.style.opacity = 0;
  }

  document.querySelectorAll('#beats i').forEach((el, i) => el.classList.toggle('on', i === b % 4));
  $('flash').style.opacity = s.cut ? 0.32 * Math.exp(-tb * 16) : 0;
  $('bar').style.width = `${(t / DURATION) * 100}%`;

  renderer.setSize(1080 * (RENDER ? 1 : Math.min(innerWidth / 1080, innerHeight / 1920)), 1920 * (RENDER ? 1 : Math.min(innerWidth / 1080, innerHeight / 1920)), false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  // The first draw after regrowing a tree compiles new materials and comes out wrong. Draw it once off the record
  if (regrown) renderer.render(scene, camera);
  renderer.render(scene, camera);
}

window.__promo = {
  FPS,
  DURATION,
  frames: Math.round(DURATION * FPS),
  tree,
  viewer,
  frame: (i) => frameAt(i / FPS),
  ready: true,
};

if (!RENDER) {
  const t0 = performance.now();
  const loop = () => {
    requestAnimationFrame(loop);
    frameAt(((performance.now() - t0) / 1000) % DURATION);
  };
  loop();
}
