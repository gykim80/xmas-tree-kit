// Vertical promo v2 (1080×1920, 30 fps, 120 BPM, 68 beats = 34 s). See promo/STORYBOARD.md.
// The page is three layers: DOM behind the tree (#back), a transparent WebGL canvas (#stage) and
// DOM in front (#front). Frames are a pure function of time, so promo/render.mjs can capture
// them one by one. Open /promo/ in the dev server to preview in real time.
import * as THREE from 'three';
import { createViewer } from '../src/index.js';
import { mulberry32 } from '../src/core/rng.js';

const FPS = 30;
const BPM = 120;
const BEAT = 60 / BPM;
const BEATS = 68;
const DURATION = BEATS * BEAT;
const RENDER = new URLSearchParams(location.search).has('render');
const W = 1080;
const H = 1920;

// Scene start beats. Keep in sync with CUTS in music.mjs
const SECTIONS = [
  ['hero', 0],
  ['seeds', 10],
  ['presets', 22],
  ['hang', 30],
  ['check', 38],
  ['ship', 46],
  ['outro', 58],
];
const BG = { hero: 'red', seeds: 'paper', presets: 'paper', hang: 'red', check: 'paper', ship: 'red', outro: 'red' };

const $ = (id) => document.getElementById(id);
const frameEl = $('frame');
if (!RENDER) {
  const fit = () => (frameEl.style.transform = `scale(${Math.min(innerWidth / W, innerHeight / H)})`);
  fit();
  addEventListener('resize', fit);
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => 1 - Math.pow(1 - clamp01(x), 3);
const easeIO = (x) => ((x = clamp01(x)) < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => {
  x = clamp01(x);
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2);
};
const punch = (dt, k = 9) => (dt < 0 ? 0 : Math.exp(-dt * k));

// ── Decorative SVG ────────────────────────────────────────
// Pine silhouettes along the bottom edge, like the shop hero
function forest(seed, height, count, color, minH, maxH) {
  const rand = mulberry32(seed);
  const w = 1160;
  let d = `M0 ${height} L0 ${height - 18} L${w} ${height - 18} L${w} ${height} Z`;
  for (let i = 0; i < count; i++) {
    const x = (i / count) * w + (rand() - 0.5) * (w / count) * 0.9;
    const th = minH + rand() * (maxH - minH);
    const tw = th * (0.36 + rand() * 0.1);
    for (let k = 0; k < 6; k++) {
      const apex = height - th + k * th * 0.135;
      const hw = tw * (0.22 + 0.16 * k) * 0.5;
      d += ` M${x.toFixed(1)} ${apex.toFixed(1)} L${(x - hw).toFixed(1)} ${(apex + th * 0.3).toFixed(1)} L${(x + hw).toFixed(1)} ${(apex + th * 0.3).toFixed(1)} Z`;
    }
    d += ` M${x - 6} ${height - th * 0.1} h12 v${th * 0.1} h-12 Z`;
  }
  return `<svg class="forest" viewBox="0 0 ${w} ${height}" preserveAspectRatio="none" style="height:${height}px"><path fill="${color}" d="${d}"/></svg>`;
}

function swirl(x, y, size, color = '#1d1414') {
  let d = '';
  for (let i = 0; i <= 120; i++) {
    const a = i * 0.17;
    const r = (i / 120) * size * 0.48;
    d += `${i ? 'L' : 'M'}${(size / 2 + Math.cos(a) * r).toFixed(1)} ${(size / 2 + Math.sin(a) * r).toFixed(1)}`;
  }
  return `<svg class="swirl" style="left:${x}px;top:${y}px;width:${size}px;height:${size}px" viewBox="0 0 ${size} ${size}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${size * 0.07}" stroke-linecap="round"/></svg>`;
}

const FOREST_FAR = forest(7, 760, 13, '#bb1f28', 360, 640);
const FOREST_NEAR = forest(21, 520, 9, '#a51b23', 260, 470);
const NAV = `<div class="nav"><span class="logo">xmas tree kit</span><span class="search">Search seeds…</span><span class="dot"></span><span class="dot"></span></div>`;
const SWIRLS = swirl(820, 120, 200) + swirl(40, 1500, 160) + swirl(900, 1700, 130);

// ── Timeline data ─────────────────────────────────────────
const NO_DECOR = { ornaments: 0, lights: 0, garland: false, beads: false, presents: 0, topper: 'none', glowLights: false, base: 'bed' };

// Seeds: one per beat, then one per half beat
const SEED_TIMES = [10, 11, 12, 13, 14, 15, 16, 17, 18, 18.5, 19, 19.5, 20, 20.5, 21, 21.5].map((b) => b * BEAT);
const SEEDS = (() => {
  const rand = mulberry32(412);
  const fixed = [412, 1225, 77, 909, 2024, 5, 314, 1414];
  return SEED_TIMES.map((_, i) => ({
    seed: fixed[i] ?? Math.floor(rand() * 9000) + 100,
    spread: +(5 + rand() * 3.4).toFixed(1),
    droop: +(0.18 + rand() * 0.44).toFixed(2),
    upturn: +(0.3 + rand() * 0.6).toFixed(2),
  }));
})();

// Builds up from bare to fully dressed
const PRESET_ORDER = ['bare', 'snowy', 'nordic', 'candy', 'rainbow', 'cozy', 'classic'];
const PRESET_NOTE = {
  bare: 'needles only',
  snowy: 'snow and a few lights',
  nordic: 'silver and blue',
  candy: 'pink and white',
  rainbow: 'every colour',
  cozy: 'tree skirt, 30 presents',
  classic: 'gold garland, star',
};

const HANG_COLORS = ['#e23b3b', '#f2c14e', '#ffffff', '#36c27a', '#3fa4ff', '#ff8fc7', '#f2c14e', '#c46cff'];
const SHAPES = ['ball', 'star', 'bell', 'heart', 'snowflake', 'drop'];
const hangEvents = [];
{
  const rand = mulberry32(99);
  let n = 0;
  for (let b = 30; b < 38; b++) {
    for (let half = 0; half < 2; half++) {
      const t = (b + half * 0.5) * BEAT;
      for (let k = 0; k < 3; k++) {
        hangEvents.push({ t, h: 0.18 + rand() * 0.68, off: (rand() - 0.5) * 1.9, shape: SHAPES[n % SHAPES.length], color: HANG_COLORS[n % HANG_COLORS.length] });
        n++;
      }
    }
  }
}

const CHECKS = [
  ['Lights', '1,900 bulbs'],
  ['Garland', 'gold beads'],
  ['Star topper', "topper: 'star'"],
  ['Snow', 'snow: 1.0'],
];

const code = (...segs) => segs; // [cls, text] pairs
const SHIP_CARDS = [
  ['On a web page', code(['', '<'], ['k', 'xmas-tree'], ['', ' preset='], ['s', '"cozy"'], ['', '\n  snowfall camera-controls>\n</'], ['k', 'xmas-tree'], ['', '>'])],
  ['In a three.js game', code(['k', 'const'], ['', ' tree = '], ['k', 'new'], ['', ' ChristmasTree({\n  preset: '], ['s', "'classic'"], ['', ', size: 6 })\nscene.'], ['k', 'add'], ['', '(tree)'])],
  ['In any engine', code(['k', 'await'], ['', ' exportGLB(tree)\n'], ['c', '// Unity · Godot · Unreal · Blender'])],
  ['Install', code(['k', 'npm i'], ['', ' three \\\n  github:gykim80/xmas-tree-kit'])],
];

// ── DOM ───────────────────────────────────────────────────
const backEl = $('back');
const frontEl = $('front');
const scenes = {};
for (const [key] of SECTIONS) {
  const b = document.createElement('div');
  const f = document.createElement('div');
  b.className = `scene ${BG[key] === 'red' ? 'red-bg' : 'paper-bg'}`;
  f.className = 'scene';
  backEl.appendChild(b);
  frontEl.appendChild(f);
  scenes[key] = { back: b, front: f };
}
const shadowEl = document.createElement('div');
shadowEl.className = 'shadow';
backEl.appendChild(shadowEl);

const S = scenes;
const q = (root, sel) => root.querySelector(sel);

const HERO_BACK = (lead) => `
  <div class="abs far" style="left:0;right:0;bottom:0">${FOREST_FAR}</div>
  <div class="abs near" style="left:0;right:0;bottom:0">${FOREST_NEAR}</div>
  <div class="abs serif white lead" style="left:0;right:0;top:420px;text-align:center;font-size:62px;font-weight:400">${lead}</div>
  <div class="abs script white word" style="left:-60px;right:-60px;top:440px;text-align:center;font-size:262px;line-height:1.3;text-shadow:0 10px 40px rgba(90,0,0,.25)">Christmas</div>`;

const WORD_FRONT = `<div class="abs script white word" style="left:-60px;right:-60px;top:440px;text-align:center;font-size:262px;line-height:1.3;clip-path:inset(-20% 0 -20% 63%)"><span class="inner" style="display:block">Christmas</span></div>`;
S.hero.back.innerHTML = HERO_BACK('A procedural tree for') + NAV;
S.hero.front.innerHTML = `
  ${WORD_FRONT}
  <div class="abs copy" style="left:84px;right:84px;top:1560px">
    <div class="serif white" style="font-size:96px;font-weight:600;line-height:1.02">Grown from<br>one seed.</div>
    <div class="sans white" style="margin-top:26px;font-size:36px;opacity:.86;line-height:1.4;max-width:820px">Branches, needles, lights and snow are built in code.</div>
  </div>`;

S.seeds.back.innerHTML = `${SWIRLS}
  <div class="card red-bg seedcard" style="left:140px;top:600px;width:800px;height:900px">
    <div class="abs" style="left:-40px;right:-40px;bottom:0">${forest(3, 420, 7, '#a51b23', 220, 400)}</div>
    <div class="abs script num" style="left:0;right:0;top:40px;text-align:center;font-size:330px;line-height:1.2;color:rgba(255,255,255,.2)"></div>
  </div>`;
S.seeds.front.innerHTML = `
  <div class="abs serif ink head" style="left:90px;top:200px;font-size:118px;font-weight:700;line-height:1">One seed,<br>one <em class="r">tree.</em></div>
  <div class="tag seedtag" style="right:110px;top:560px"></div>
  <div class="abs mono meta" style="left:0;right:0;top:1580px;text-align:center;font-size:38px;color:rgba(29,20,20,.6)"></div>
  <div class="abs sans" style="left:0;right:0;top:1660px;text-align:center;font-size:38px;color:rgba(29,20,20,.55)">Same seed, same tree, every time.</div>`;

S.presets.back.innerHTML = `${SWIRLS}
  <div class="card pcard" style="left:120px;top:560px;width:840px;height:980px;background:var(--card)"></div>`;
S.presets.front.innerHTML = `
  <div class="abs serif ink head" style="left:90px;top:200px;font-size:118px;font-weight:700;line-height:1">Pick a<br><em class="r">preset.</em></div>
  <div class="abs pmeta" style="left:120px;width:840px;top:560px;height:980px">
    <div class="abs mono price" style="right:52px;top:46px;font-size:40px;font-weight:700;color:var(--red-ink)"></div>
    <div class="abs serif ink name" style="left:0;right:0;bottom:92px;text-align:center;font-size:68px;font-weight:600"></div>
    <div class="abs sans note" style="left:0;right:0;bottom:46px;text-align:center;font-size:34px;color:rgba(29,20,20,.55)"></div>
  </div>
  <div class="arrow" style="left:60px;top:1620px">←</div>
  <div class="arrow next" style="right:60px;top:1620px">→</div>
  <div class="abs serif ink count" style="left:0;right:0;top:1640px;text-align:center;font-size:52px;font-weight:600"></div>`;

S.hang.back.innerHTML = `<div class="abs" style="left:0;right:0;bottom:0">${FOREST_FAR}</div><div class="abs" style="left:0;right:0;bottom:0">${FOREST_NEAR}</div>`;
S.hang.front.innerHTML = `
  <div class="abs serif white head" style="left:90px;top:170px;font-size:104px;font-weight:700;line-height:1.02">Hang your own<br>ornaments.</div>
  <div class="abs script white counter" style="left:0;right:0;top:1470px;text-align:center;font-size:170px;line-height:1.3;text-shadow:0 10px 40px rgba(90,0,0,.35)"></div>
  <div class="abs" style="left:0;right:0;top:1760px;text-align:center"><span class="pill white mono call" style="font:500 34px 'Mono',monospace"></span></div>`;

S.check.back.innerHTML = `${SWIRLS}
  <div class="card red-bg" style="left:80px;top:500px;width:920px;height:760px">
    <div class="abs" style="left:-40px;right:-40px;bottom:0">${forest(11, 380, 8, '#a51b23', 200, 360)}</div>
  </div>`;
S.check.front.innerHTML = `
  <div class="abs serif ink head" style="left:90px;top:170px;font-size:100px;font-weight:700;line-height:1.02">Finish the<br><em class="r">decorating</em> list.</div>
  ${CHECKS.map(([n, v], i) => `<div class="row" style="top:${1320 + i * 128}px"><span class="tick"></span><span class="name">${n}</span><span class="val">${v}</span></div>`).join('')}`;

S.ship.back.innerHTML = `<div class="abs" style="left:0;right:0;bottom:0">${FOREST_FAR}</div>`;
S.ship.front.innerHTML = `
  <div class="abs script white title" style="left:0;right:0;top:90px;text-align:center;font-size:132px;line-height:1.3;text-shadow:0 10px 40px rgba(90,0,0,.3)">Drop it anywhere</div>
  ${SHIP_CARDS.map(([h], i) => `<div class="code-card" data-i="${i}"><h3><b>0${i + 1}</b>${h}</h3><pre></pre></div>`).join('')}`;

S.outro.back.innerHTML = HERO_BACK('Grow your own tree for') + NAV;
S.outro.front.innerHTML = `${WORD_FRONT}
  <div class="abs" style="left:0;right:0;top:1560px;text-align:center"><span class="pill white cta" style="font-size:40px">★ github.com/gykim80/xmas-tree-kit</span></div>
  <div class="abs serif white lic" style="left:0;right:0;top:1730px;text-align:center;font-size:44px;font-weight:600">Open source · MIT</div>`;

// ── 3D ────────────────────────────────────────────────────
const viewer = createViewer($('stage'), {
  background: 'transparent',
  controls: false,
  autoRotate: false,
  ground: false,
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
// Daylight on a transparent canvas, so the page colour shows through
const hemi = scene.children.find((o) => o.isHemisphereLight);
const sun = scene.children.find((o) => o.isDirectionalLight);
hemi.color.set('#fff4ea');
hemi.groundColor.set('#6a2a2a');
hemi.intensity = 1.15;
sun.color.set('#fff0da');
sun.intensity = 2.3;
renderer.toneMappingExposure = 1.0;
scene.environmentIntensity = 0.55;

// Growth wipe: everything above the plane is clipped, plus a glowing scan ring at the cut
const clip = new THREE.Plane(new THREE.Vector3(0, -1, 0), 100);
renderer.clippingPlanes = [clip];
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.94, 1, 96),
  new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false })
);
ring.material.clippingPlanes = [];
ring.rotation.x = -Math.PI / 2;
ring.renderOrder = 10;
scene.add(ring);

const TREE_H = 2.75; // tree plus topper, world units
const FOV = 30;
const base = new THREE.Vector3();
// Put the tree base at (cx, by) on screen, hPx tall, seen from angle a
function place(cx, by, hPx, a, elev = 0.12) {
  const d = (TREE_H * H) / (2 * Math.tan(THREE.MathUtils.degToRad(FOV / 2)) * hPx);
  const cy = TREE_H * 0.5;
  camera.fov = FOV;
  camera.aspect = W / H;
  camera.near = 0.05;
  camera.far = 200;
  camera.position.set(Math.cos(a) * d, cy + d * elev, Math.sin(a) * d);
  camera.lookAt(0, cy, 0);
  camera.setViewOffset(W, H, -(cx - W / 2), -(by - hPx / 2 - H / 2), W, H);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  base.set(0, 0, 0).project(camera);
  shadowEl.style.left = `${((base.x + 1) / 2) * W}px`;
  shadowEl.style.top = `${((1 - base.y) / 2) * H}px`;
  shadowEl.style.width = `${hPx * 0.82}px`;
  shadowEl.style.height = `${hPx * 0.12}px`;
}

let applied = '';
function applyTree(preset, treeOpts, decor) {
  const want = JSON.stringify([preset, treeOpts, decor]);
  if (want === applied) return false;
  applied = want;
  tree.options.preset = preset;
  tree.options.tree = { ...treeOpts };
  tree.options.decor = { ...decor };
  tree.generate();
  return true;
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
const segLen = (segs) => segs.reduce((n, [, x]) => n + x.length, 0);

const show = (el, on) => (el.style.opacity = on ? 1 : 0);
const rise = (el, p, dist = 60) => {
  el.style.opacity = clamp01(p * 1.6);
  el.style.transform = `translateY(${(1 - ease(p)) * dist}px)`;
};

// ── Frame ─────────────────────────────────────────────────
let hangDone = 0;
let lastT = -1;
let lastSec = '';

function section(b) {
  let i = SECTIONS.length - 1;
  while (SECTIONS[i][1] > b) i--;
  return i;
}

function frameAt(t) {
  t = Math.min(t, DURATION - 1e-4);
  const b = Math.floor(t / BEAT);
  const tb = t - b * BEAT;
  const si = section(b);
  const [key, start] = SECTIONS[si];
  const t0 = start * BEAT;
  const lt = t - t0; // time in this scene
  const sc = S[key];

  if (t < lastT) {
    tree.ornaments.clear();
    hangDone = 0;
  }
  lastT = t;
  if (key !== lastSec) {
    for (const k in S) {
      show(S[k].back, k === key);
      show(S[k].front, k === key);
    }
    lastSec = key;
  }

  const a = 0.85 + t * 0.3; // camera orbit
  const hit = punch(tb, 9); // every beat
  let grow = null; // { from, dur }
  let regrown = false;
  let snowCover = null;
  let flakes = false;

  if (key === 'hero' || key === 'outro') {
    const outro = key === 'outro';
    regrown = applyTree('classic', {}, {});
    const growAt = outro ? t0 : 4 * BEAT;
    grow = { from: growAt, dur: outro ? 1.1 : 1.4 };
    flakes = true;
    const tg = t - growAt;
    const h = 1040 * (1 + 0.035 * hit) * (tg < 0 ? 1 : 1 + 0.06 * punch(tg, 5));
    place(540, outro ? 1500 : 1490, h, a - (outro ? 0.6 : 0), 0.1);
    // forests rise, the script word is written left to right
    q(sc.back, '.far').style.transform = `translateY(${(1 - ease(lt / 1.1)) * 380}px)`;
    q(sc.back, '.near').style.transform = `translateY(${(1 - ease((lt - 0.15) / 1.0)) * 420}px)`;
    rise(q(sc.back, '.lead'), (lt - 0.35) / 0.5, 30);
    const word = q(sc.back, '.word');
    const fword = q(sc.front, '.word');
    const wp = outro ? easeIO((lt - 0.2) / 0.9) : easeIO((lt - 0.5) / 1.4);
    word.style.clipPath = `inset(-20% ${(1 - wp) * 100}% -20% 0)`;
    fword.style.clipPath = `inset(-20% ${(1 - wp) * 100}% -20% 63%)`;
    const slamAt = outro ? 64 * BEAT : 4 * BEAT;
    const ws = `scale(${1 + 0.1 * punch(t - slamAt, 7) + 0.012 * hit})`;
    word.style.transform = ws;
    fword.style.transform = ws;
    if (!outro) {
      rise(q(sc.front, '.copy'), (lt - 3.0) / 0.5, 80);
    } else {
      const cta = q(sc.front, '.cta');
      const cp = (t - 60 * BEAT) / 0.35;
      cta.style.opacity = clamp01(cp * 2);
      cta.style.display = 'inline-flex';
      cta.style.transform = `scale(${0.6 + 0.4 * back(cp)}) scale(${1 + 0.05 * punch(t - 64 * BEAT, 8)})`;
      rise(q(sc.front, '.lic'), (t - 61 * BEAT) / 0.4, 40);
    }
  } else if (key === 'seeds') {
    let i = 0;
    while (i + 1 < SEED_TIMES.length && SEED_TIMES[i + 1] <= t) i++;
    const s = SEEDS[i];
    const since = t - SEED_TIMES[i];
    regrown = applyTree('bare', { seed: s.seed, spread: s.spread, droop: s.droop, upturn: s.upturn }, NO_DECOR);
    grow = { from: SEED_TIMES[i], dur: i >= 8 ? 0.2 : 0.3 };
    snowCover = 0.35;
    place(540, 1450, 1000 * (1 + 0.04 * punch(since, 10)), a, 0.08);
    const id = String(s.seed).padStart(4, '0');
    q(sc.back, '.num').textContent = s.seed;
    q(sc.back, '.num').style.transform = `scale(${1 + 0.12 * punch(since, 12)})`;
    q(sc.back, '.seedcard').style.transform = `scale(${1 + 0.025 * punch(since, 10)})`;
    const tag = q(sc.front, '.seedtag');
    tag.textContent = `#${id}`;
    tag.style.transform = `scale(${1 + 0.2 * punch(since, 14)}) rotate(${-4 + 4 * ease(since / 0.2)}deg)`;
    q(sc.front, '.meta').textContent = `seed ${s.seed} · spread ${s.spread} · droop ${s.droop}`;
    rise(q(sc.front, '.head'), lt / 0.45, 70);
  } else if (key === 'presets') {
    const i = Math.min(PRESET_ORDER.length - 1, b - 22);
    const p = PRESET_ORDER[i];
    const since = t - (22 + i) * BEAT;
    regrown = applyTree(p, {}, {});
    const slide = (1 - ease(since / 0.26)) * 1000;
    place(540 + slide, 1340, 830, a, 0.1);
    q(sc.back, '.pcard').style.transform = `translateX(${slide}px)`;
    const meta = q(sc.front, '.pmeta');
    meta.style.transform = `translateX(${slide}px)`;
    q(meta, '.price').textContent = `"${p}"`;
    q(meta, '.name').textContent = p[0].toUpperCase() + p.slice(1);
    q(meta, '.note').textContent = PRESET_NOTE[p];
    q(sc.front, '.count').textContent = `0${i + 1} / 07`;
    const next = q(sc.front, '.next');
    const np = punch(since, 10);
    next.style.background = `rgba(200,32,42,${np})`;
    next.style.color = np > 0.4 ? '#fff' : 'var(--ink)';
    next.style.transform = `scale(${1 + 0.15 * np})`;
    rise(q(sc.front, '.head'), lt / 0.45, 70);
  } else if (key === 'hang') {
    regrown = applyTree('classic', {}, { ornaments: 0 });
    flakes = true;
    place(540, 1440, 1060 * (1 + 0.02 * hit), a, 0.1);
    rise(q(sc.front, '.head'), lt / 0.45, 70);
  } else if (key === 'check') {
    const step = Math.min(3, Math.floor((b - 38) / 2));
    const decor = { ...NO_DECOR, ornaments: 40 };
    if (step >= 0) Object.assign(decor, { lights: 1900, glowLights: true });
    if (step >= 1) Object.assign(decor, { garland: true, beads: true });
    if (step >= 2) Object.assign(decor, { topper: 'star', presents: 26 });
    regrown = applyTree('classic', {}, decor);
    snowCover = step === 3 ? ease((t - 44 * BEAT) / 0.8) : 0;
    flakes = step === 3;
    const since = t - (38 + step * 2) * BEAT;
    place(540, 1215, 820 * (1 + 0.04 * punch(since, 8)), a, 0.1);
    rise(q(sc.front, '.head'), lt / 0.45, 70);
    sc.front.querySelectorAll('.row').forEach((row, k) => {
      const tick = q(row, '.tick');
      const done = k <= step;
      const kp = t - (38 + k * 2) * BEAT;
      tick.style.background = done ? 'var(--red)' : 'transparent';
      tick.style.borderColor = done ? 'var(--red)' : 'rgba(29,20,20,.22)';
      tick.textContent = done ? '✓' : '';
      tick.style.transform = `scale(${done ? 0.4 + 0.6 * back(kp / 0.25) : 1})`;
      row.style.opacity = k <= step ? 1 : 0.45;
      row.style.transform = `translateX(${k === step ? 14 * punch(kp, 6) : 0}px)`;
    });
  } else if (key === 'ship') {
    regrown = applyTree('cozy', {}, {});
    flakes = true;
    place(540, 1100, 860 * (1 + 0.03 * hit), a, 0.14);
    const title = q(sc.front, '.title');
    title.style.transform = `scale(${0.8 + 0.2 * back(lt / 0.35)})`;
    title.style.opacity = clamp01(lt / 0.15);
    const cur = Math.min(3, Math.floor((b - 46) / 3));
    sc.front.querySelectorAll('.code-card').forEach((card, k) => {
      const ct = t - (46 + k * 3) * BEAT;
      if (ct < 0) return (card.style.opacity = 0);
      const depth = cur - k;
      const enter = ease(ct / 0.35);
      const y = 1250 + (1 - enter) * 800 - depth * 52;
      card.style.top = `${y}px`;
      card.style.opacity = depth >= 3 ? 0 : 1 - depth * 0.12;
      card.style.transform = `scale(${1 - depth * 0.05})`;
      card.style.zIndex = 10 + k;
      card.style.filter = depth ? `brightness(${1 - depth * 0.08})` : 'none';
      const [, segs] = SHIP_CARDS[k];
      const p = (ct - 0.2) / 0.9;
      q(card, 'pre').innerHTML = typed(segs, Math.ceil(ease(p) * segLen(segs))) + (depth === 0 && Math.floor(t * 4) % 2 === 0 ? '▍' : '');
    });
  }

  // Ornaments: only during the hang scene, hung on schedule facing the camera
  if (key !== 'hang') {
    if (tree.ornaments.count) tree.ornaments.clear();
    hangDone = 0;
  } else {
    while (hangDone < hangEvents.length && hangEvents[hangDone].t <= t) {
      const e = hangEvents[hangDone++];
      tree.addOrnament({ shape: e.shape, color: e.color, h: e.h, a: 0.85 + e.t * 0.3 + e.off });
    }
    const n = tree.ornaments.count;
    const counter = q(sc.front, '.counter');
    counter.textContent = n ? `×${n}` : '';
    const th = t % (BEAT / 2);
    counter.style.transform = `scale(${1 + 0.22 * punch(th, 16)})`;
    const last = hangEvents[Math.max(0, hangDone - 1)];
    q(sc.front, '.call').textContent = `tree.addOrnament({ shape: '${last.shape}' })`;
  }

  tree.update(t);
  tree.uniforms.uSnow.value = snowCover ?? tree.resolved.snow;

  // Growth wipe
  const gp = grow ? ease((t - grow.from) / grow.dur) : 1;
  clip.constant = gp <= 0 ? -1 : gp < 1 ? gp * TREE_H : 100;
  ring.visible = gp > 0 && gp < 1;
  if (ring.visible) {
    const y = clip.constant;
    const r = Math.max(0.15, tree.footprint.crownRadius * 1.15 * (1 - (y / TREE_H) * 0.9));
    ring.position.y = y - 0.005;
    ring.scale.setScalar(r);
    ring.material.opacity = 0.95 * (1 - gp);
  }
  shadowEl.style.opacity = clamp01(gp * 3) * (BG[key] === 'red' ? 0.9 : 0.6);

  const sf = snowfall();
  if (sf) {
    sf.visible = flakes;
    sf.userData.step(1 / FPS, t);
  }

  // ── Transitions: whip wipe in the next page colour across every cut ──
  const wipe = $('wipe');
  let wp = -1;
  let wipeKey = '';
  for (const [k, s0] of SECTIONS.slice(1)) {
    const d = t - s0 * BEAT;
    if (d > -0.26 && d < 0.26) {
      wp = (d + 0.26) / 0.52;
      wipeKey = k;
    }
  }
  if (wp >= 0) {
    wipe.style.display = 'block';
    wipe.style.background = BG[wipeKey] === 'red' ? (key === 'ship' || wipeKey === 'outro' ? 'var(--red-deep)' : 'var(--red)') : 'var(--paper)';
    wipe.style.transform = `translateY(${(1 - easeIO(wp) * 2.15) * 100}%)`;
  } else wipe.style.display = 'none';

  const drop = Math.max(punch(t - 4 * BEAT, 7), punch(t - 64 * BEAT, 6));
  $('flash').style.opacity = 0.6 * drop + 0.08 * hit * (key === 'seeds' || key === 'presets' ? 1 : 0);

  renderer.setSize(W * (RENDER ? 1 : Math.min(innerWidth / W, innerHeight / H)), H * (RENDER ? 1 : Math.min(innerWidth / W, innerHeight / H)), false);
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
  ready: false,
};

await Promise.all(["40px Script", "40px Sans", "600 40px Serif", "40px Mono"].map((f) => document.fonts.load(f)));
window.__promo.ready = true;

if (!RENDER) {
  const t0 = performance.now();
  const loop = () => {
    requestAnimationFrame(loop);
    frameAt(((performance.now() - t0) / 1000) % DURATION);
  };
  loop();
}
