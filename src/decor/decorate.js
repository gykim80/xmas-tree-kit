import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, lerp, clamp } from '../core/rng.js';
import { glowTexture, wrapTexture, stoneTexture } from '../textures.js';
import { createBulbMaterial, setBulbPhases } from '../materials.js';
import { ornamentGeometry, HAS_CAP } from './shapes.js';

// Auto-decoration defaults
export const DECOR_DEFAULTS = {
  ornaments: 620, // number of auto-hung ornaments
  ornamentSize: 1.0,
  ornamentShapes: { ball: 0.78, drop: 0.22 }, // ratio per shape
  palette: 'classic', // name or array of colors
  lights: 2200, // number of lights
  lightColor: 'warm', // name or array of [r,g,b] arrays (0-1)
  trunkLights: true, // light string wound around the bare trunk
  garland: true, // tinsel garland
  garlandColor: '#f0c25a',
  beads: true, // bead strings
  beadColors: ['#f3f0ea', '#b0141e'],
  topper: 'star', // 'star' | 'none'
  topperColor: '#ffd76a',
  presents: 26, // number of presents
  base: 'bed', // 'bed' (stone bed) | 'skirt' (tree skirt) | 'none'
  skirtColor: '#9c1018',
  glowLights: true, // star and inner point lights (turn off for cheaper rendering with many trees in a game)
};

export const PALETTES = {
  classic: ['#a5121c', '#c99a2e', '#d6dbe2', '#a5121c', '#c99a2e'],
  'red-gold': ['#9c0f19', '#c4141f', '#d4a537', '#e2b84c'],
  'silver-blue': ['#c8d0da', '#1d3f8f', '#2f63c2', '#e7ecf2'],
  rainbow: ['#b3121f', '#d4a43a', '#1d4f9f', '#0f7a45', '#8c2a8f', '#d9dee6'],
  candy: ['#e23b5a', '#f4f4f4', '#ff8fc7', '#f4f4f4'],
  forest: ['#7a1414', '#2f5d3a', '#c99a2e', '#e8dcc2'],
};

export const LIGHT_COLORS = {
  warm: [[1.0, 0.72, 0.38]],
  cool: [[0.75, 0.85, 1.0]],
  multi: [[1.0, 0.18, 0.12], [0.2, 0.9, 0.3], [0.25, 0.45, 1.0], [1.0, 0.75, 0.15], [0.95, 0.3, 0.8]],
  'red-green': [[1.0, 0.15, 0.1], [0.2, 0.95, 0.3], [1.0, 0.7, 0.35]],
};

const resolvePalette = (p) => (Array.isArray(p) && p.length ? p : PALETTES[p] ?? PALETTES.classic);
const resolveLights = (l) => {
  if (Array.isArray(l) && l.length) return l.map((c) => (typeof c === 'string' ? new THREE.Color(c).toArray() : c));
  return LIGHT_COLORS[l] ?? LIGHT_COLORS.warm;
};

// Pick from candidates while keeping a minimum spacing
function pickSpread(cands, count, minDist, rand) {
  const pool = cands.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const out = [];
  const md2 = minDist * minDist;
  for (const c of pool) {
    if (out.length >= count) break;
    if (out.every((o) => o.p.distanceToSquared(c.p) > md2)) out.push(c);
  }
  return out;
}

// Polyhedral star bulging front and back (reads as a star from any angle)
function topperGeometry() {
  const pos = [];
  const ring = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.15 : 0.36;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    ring.push([Math.cos(a) * r, Math.sin(a) * r, 0]);
  }
  const front = [0, 0, 0.12];
  const back = [0, 0, -0.12];
  for (let i = 0; i < 10; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % 10];
    pos.push(...front, ...a, ...b, ...back, ...b, ...a);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

function buildPresent(rand, w, h, d, base, accent, style) {
  const g = new THREE.Group();
  const tex = wrapTexture(base, accent, style)?.clone() ?? null;
  if (tex) {
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, w * 2), Math.max(1, h * 2));
  }
  const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ map: tex, color: tex ? '#ffffff' : base, roughness: 0.6 }));
  box.userData.mergeKey = `wrap-${base}-${accent}-${style}`;
  box.position.y = h / 2;
  const ribbonCol = rand() < 0.5 ? '#d8b24a' : '#f2f2f2';
  const ribbonMat = new THREE.MeshStandardMaterial({ color: ribbonCol, metalness: 0.4, roughness: 0.35 });
  const rk = Math.max(1, Math.min(w, d) / 0.35);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(w + 0.01, h + 0.01, 0.06 * rk), ribbonMat);
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.06 * rk, h + 0.01, d + 0.01), ribbonMat);
  r1.position.y = r2.position.y = h / 2;
  const bowGeo = new THREE.TorusGeometry(0.07 * rk, 0.022 * rk, 8, 16);
  const b1 = new THREE.Mesh(bowGeo, ribbonMat);
  const b2 = new THREE.Mesh(bowGeo, ribbonMat);
  b1.position.set(-0.06 * rk, h + 0.05 * rk, 0);
  b2.position.set(0.06 * rk, h + 0.05 * rk, 0);
  b1.rotation.set(0, Math.PI / 2, 0.5);
  b2.rotation.set(0, Math.PI / 2, -0.5);
  b1.scale.set(1, 0.7, 1);
  b2.scale.set(1, 0.7, 1);
  for (const m of [r1, r2, b1, b2]) m.userData.mergeKey = `ribbon-${ribbonCol}`;
  for (const m of [box, r1, r2, b1, b2]) g.add(m);
  return g;
}

// Trunk surround: stone bed (border, snow mound, posts, ribbon). Returns a ground height function
function buildBed(tree, group, keep) {
  const bedR = Math.max(3.2, tree.trunkRadius * 5.5);
  const curbGeo = keep(
    new THREE.LatheGeometry(
      [
        // start at the outer bottom and wind inward so faces point outward
        new THREE.Vector2(bedR + 0.3, -0.05),
        new THREE.Vector2(bedR + 0.3, 0.36),
        new THREE.Vector2(bedR + 0.22, 0.44),
        new THREE.Vector2(bedR - 0.26, 0.44),
        new THREE.Vector2(bedR - 0.34, 0.36),
        new THREE.Vector2(bedR - 0.32, -0.05),
      ],
      72
    )
  );
  const stone = stoneTexture()?.clone() ?? null;
  if (stone) {
    stone.needsUpdate = true;
    stone.repeat.set(14, 1);
  }
  const curb = new THREE.Mesh(curbGeo, keep(new THREE.MeshStandardMaterial({ map: stone, color: stone ? '#d8d2c8' : '#77736d', roughness: 0.92 })));
  if (stone) keep(stone);
  curb.castShadow = true;
  curb.receiveShadow = true;
  const capSnow = new THREE.Mesh(
    keep(new THREE.TorusGeometry(bedR - 0.02, 0.2, 8, 72).scale(1, 1, 0.32)),
    keep(new THREE.MeshStandardMaterial({ color: '#eef3fa', roughness: 0.85 }))
  );
  capSnow.rotation.x = Math.PI / 2;
  capSnow.position.y = 0.46;
  capSnow.receiveShadow = true;
  // Snow mound inside the bed: slightly raised toward the trunk
  const r0 = tree.trunkRadius * 0.9;
  const moundPts = [];
  for (let i = 0; i <= 12; i++) {
    const u = i / 12;
    moundPts.push(new THREE.Vector2(lerp(r0, bedR - 0.3, u), lerp(0.48, 0.3, Math.pow(u, 0.6))));
  }
  const mound = new THREE.Mesh(
    keep(new THREE.LatheGeometry(moundPts, 72)),
    keep(new THREE.MeshStandardMaterial({ color: '#e4ebf5', roughness: 0.9, side: THREE.DoubleSide }))
  );
  mound.receiveShadow = true;
  // Low iron posts and a red ribbon along the border
  const posts = 16;
  const m = new THREE.Matrix4();
  const postMesh = new THREE.InstancedMesh(
    keep(new THREE.CylinderGeometry(0.045, 0.055, 0.7, 8)),
    keep(new THREE.MeshStandardMaterial({ color: '#1f2a24', metalness: 0.7, roughness: 0.45 })),
    posts
  );
  const knobMesh = new THREE.InstancedMesh(
    keep(new THREE.SphereGeometry(0.075, 12, 8)),
    keep(new THREE.MeshStandardMaterial({ color: '#caa24a', metalness: 1, roughness: 0.3 })),
    posts
  );
  const postR = bedR + 0.02;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    m.makeTranslation(Math.cos(a) * postR, 0.79, Math.sin(a) * postR);
    postMesh.setMatrixAt(i, m);
    m.makeTranslation(Math.cos(a) * postR, 1.18, Math.sin(a) * postR);
    knobMesh.setMatrixAt(i, m);
  }
  const ropePts = [];
  for (let i = 0; i <= posts * 12; i++) {
    const u = i / 12;
    const a = (u / posts) * Math.PI * 2;
    const sag = Math.sin((u % 1) * Math.PI) * 0.16;
    ropePts.push(new THREE.Vector3(Math.cos(a) * postR, 1.06 - sag, Math.sin(a) * postR));
  }
  const rope = new THREE.Mesh(
    keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts, true), posts * 24, 0.022, 5, true)),
    keep(new THREE.MeshStandardMaterial({ color: '#9c1018', roughness: 0.55 }))
  );
  postMesh.castShadow = true;
  rope.castShadow = true;
  keep(postMesh);
  keep(knobMesh);
  group.add(curb, capSnow, mound, postMesh, knobMesh, rope);
  return {
    radius: bedR - 0.4,
    floor: (r) => lerp(0.48, 0.3, Math.pow(clamp((r - r0) / (bedR - 0.3 - r0), 0, 1), 0.6)),
  };
}

// Tree skirt: cloth spread on the floor around the trunk, with white fur trim
function buildSkirt(tree, group, keep, color) {
  const R = Math.max(3.4, tree.trunkRadius * 6);
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const u = i / 16;
    // slightly raised near the trunk, flat toward the edge. Folds come from the wave below
    pts.push(new THREE.Vector2(lerp(tree.trunkRadius * 0.95, R, u), lerp(0.22, 0.03, Math.pow(u, 0.5))));
  }
  const geo = keep(new THREE.LatheGeometry(pts, 96));
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    pos.setY(i, pos.getY(i) + Math.sin(a * 9) * 0.05 * (r / R));
  }
  geo.computeVertexNormals();
  const cloth = new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({ color, roughness: 0.95, side: THREE.DoubleSide })));
  cloth.receiveShadow = true;
  const rim = new THREE.Mesh(
    keep(new THREE.TorusGeometry(R, 0.14, 8, 96).scale(1, 1, 0.6)),
    keep(new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 1 }))
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.06;
  rim.receiveShadow = true;
  group.add(cloth, rim);
  return { radius: R - 0.3, floor: (r) => lerp(0.22, 0.03, Math.pow(clamp(r / R, 0, 1), 0.5)) };
}

export function buildDecorations(tree, input, uniforms) {
  const params = { ...DECOR_DEFAULTS, ...input };
  const rand = mulberry32(tree.params.seed * 31 + 7);
  const H = tree.height;
  const K = H / 7.2; // scale relative to the reference height
  const group = new THREE.Group();
  group.name = 'decor';
  const disposables = [];
  const keep = (o) => (disposables.push(o), o);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const col = new THREE.Color();

  // 1) Ornaments
  const palette = resolvePalette(params.palette);
  const shapeW = Object.entries(params.ornamentShapes ?? { ball: 1 }).filter(([, w]) => w > 0);
  const shapeSum = shapeW.reduce((s, [, w]) => s + w, 0) || 1;
  const pickShape = () => {
    let r = rand() * shapeSum;
    for (const [k, w] of shapeW) if ((r -= w) <= 0) return k;
    return shapeW[0]?.[0] ?? 'ball';
  };
  // thin out low candidates so ornaments don't band along the bottom branch tips
  const cands = tree.anchors.filter((a) => rand() < clamp((a.p.y - tree.crownBase) / 2.5, 0.2, 1));
  const spots = pickSpread(cands, params.ornaments, 0.32 * Math.sqrt(K), rand);
  const byShape = new Map();
  for (const s of spots) {
    const k = pickShape();
    if (!byShape.has(k)) byShape.set(k, []);
    byShape.get(k).push(s);
  }
  const ornMat = keep(new THREE.MeshPhysicalMaterial({ metalness: 0.85, roughness: 0.16, clearcoat: 1, clearcoatRoughness: 0.08 }));
  const capMat = keep(new THREE.MeshStandardMaterial({ color: '#c9a548', metalness: 1, roughness: 0.3 }));
  const capMesh = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(0.2, 0.2, 0.25, 10)), capMat, Math.max(1, spots.length));
  const ornamentLods = [];
  let capIdx = 0;
  const up = new THREE.Vector3(0, 1, 0);
  for (const [shape, list] of byShape) {
    const high = keep(ornamentGeometry(shape, 'high'));
    const low = shape === 'ball' || shape === 'drop' ? keep(ornamentGeometry(shape, 'low')) : high;
    const mesh = new THREE.InstancedMesh(high, ornMat, list.length);
    mesh.name = `ornaments-${shape}`;
    ornamentLods.push({ mesh, high, low });
    const flat = !HAS_CAP.has(shape) && shape !== 'bell';
    list.forEach((s, i) => {
      const size = lerp(0.12, 0.07, clamp(s.p.y / H, 0, 1)) * Math.pow(K, 0.75) * (0.85 + rand() * 0.3) * params.ornamentSize * (flat ? 0.95 : 1);
      // hang slightly below the branch tip
      const pos = s.p.clone();
      pos.y -= size * 1.4 + 0.03 * K;
      pos.addScaledVector(new THREE.Vector3(s.p.x, 0, s.p.z).normalize(), 0.04);
      // flat shapes face outward, round ones any direction
      q.setFromAxisAngle(up, flat ? Math.atan2(s.p.x, s.p.z) + (rand() - 0.5) * 0.6 : rand() * 6.28);
      m.compose(pos, q, new THREE.Vector3(size, size, size));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, col.set(palette[Math.floor(rand() * palette.length)]));
      if (HAS_CAP.has(shape)) {
        m.compose(pos.clone().setY(pos.y + size * 1.02), q, new THREE.Vector3(size, size, size));
        capMesh.setMatrixAt(capIdx++, m);
      }
    });
    mesh.castShadow = true;
    group.add(mesh);
    keep(mesh);
  }
  capMesh.count = capIdx;
  group.add(capMesh);
  keep(capMesh);

  // 2) Lights: outer twig tips
  const lightCols = resolveLights(params.lightColor);
  const lightSpots = pickSpread(tree.tips.filter((t) => t.p.y > 0.4 * K), params.lights, 0.2 * Math.sqrt(K), rand);
  // spiral a light string around the bare trunk
  if (params.lights > 0 && params.trunkLights) {
    const top = tree.crownBase + 0.4;
    const n = 150;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const y = lerp(0.35, top, u);
      const a = u * 7 * Math.PI * 2;
      const r = tree.trunkAt(y).r + 0.035;
      const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      lightSpots.push({ p: new THREE.Vector3(d.x * r - d.x * 0.05, y - 0.02, d.z * r - d.z * 0.05), d });
    }
  }
  const bulbMat = keep(createBulbMaterial(uniforms));
  const bulbs = new THREE.InstancedMesh(keep(new THREE.IcosahedronGeometry(0.028 * Math.sqrt(K), 0)), bulbMat, Math.max(1, lightSpots.length));
  bulbs.name = 'bulbs';
  bulbs.count = lightSpots.length;
  lightSpots.forEach((s, i) => {
    m.makeTranslation(s.p.x + s.d.x * 0.05, s.p.y + 0.02, s.p.z + s.d.z * 0.05);
    bulbs.setMatrixAt(i, m);
    const c = lightCols[Math.floor(rand() * lightCols.length)];
    bulbs.setColorAt(i, col.setRGB(c[0], c[1], c[2]));
  });
  setBulbPhases(bulbs, rand);
  group.add(bulbs);
  keep(bulbs);

  // 3) Garland: spirals around the outside and sags between anchor points
  const helix = (phase, turns, inset, sag) => {
    const pts = [];
    const top = H * 0.86;
    const bottom = tree.crownBase + H * 0.04;
    for (let i = 0; i <= 500; i++) {
      const u = i / 500;
      const theta = u * turns * Math.PI * 2 + phase;
      let y = lerp(top, bottom, u);
      const seg = (theta / (Math.PI / 2.5)) % 1;
      y -= sag * Math.sin(seg * Math.PI) * lerp(0.6, 1.2, u);
      const r = tree.envAt(y) * inset + 0.02;
      pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
    }
    return pts;
  };
  if (params.garland) {
    const gc = new THREE.Color(params.garlandColor);
    const curve = new THREE.CatmullRomCurve3(helix(0, 5, 0.82, 0.2 * K));
    const core = new THREE.Mesh(
      keep(new THREE.TubeGeometry(curve, 1400, 0.012 * K, 4)),
      keep(new THREE.MeshStandardMaterial({ color: gc.clone().multiplyScalar(0.7), metalness: 1, roughness: 0.4 }))
    );
    core.name = 'garland';
    group.add(core);
    // attach thin tinsel strands all around the rope for a fluffy look
    const n = Math.floor(curve.getLength() / (0.008 * K));
    const tinselMat = keep(
      new THREE.MeshStandardMaterial({ color: gc, metalness: 1, roughness: 0.42, side: THREE.DoubleSide, emissive: gc.clone().multiplyScalar(0.25), emissiveIntensity: 0.6 })
    );
    const tinsel = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(0.1 * K, 0.007 * K)), tinselMat, n * 2);
    tinsel.name = 'tinsel';
    const e = new THREE.Euler();
    const sc = new THREE.Vector3();
    for (let i = 0; i < n * 2; i++) {
      const p = curve.getPointAt((i >> 1) / n);
      q.setFromEuler(e.set(rand() * 6.28, rand() * 6.28, rand() * 6.28));
      sc.setScalar(0.6 + rand() * 0.7);
      m.compose(p, q, sc);
      tinsel.setMatrixAt(i, m);
      const v = 0.75 + rand() * 0.5;
      tinsel.setColorAt(i, col.setRGB(v, v * (0.92 + rand() * 0.1), v * 0.85));
    }
    group.add(tinsel);
    keep(tinsel);
  }
  if (params.beads) {
    const curve = new THREE.CatmullRomCurve3(helix(Math.PI, 4.4, 0.86, 0.14 * K));
    const n = Math.floor(curve.getLength() / (0.055 * K));
    const beadCols = params.beadColors?.length ? params.beadColors : DECOR_DEFAULTS.beadColors;
    const beads = new THREE.InstancedMesh(
      keep(new THREE.SphereGeometry(0.022 * K, 6, 4)),
      keep(new THREE.MeshPhysicalMaterial({ metalness: 0.3, roughness: 0.2, clearcoat: 1 })),
      n
    );
    beads.name = 'beads';
    for (let i = 0; i < n; i++) {
      m.makeTranslation(curve.getPointAt(i / n));
      beads.setMatrixAt(i, m);
      beads.setColorAt(i, col.set(beadCols[i % beadCols.length]));
    }
    group.add(beads);
    keep(beads);
  }

  // Point lights: [light, intensity in design units]. Intensity and distance scale down with the tree (lightScale)
  const inner = [];

  // 4) Topper star
  let star = null;
  let starMesh = null;
  let halo = null;
  if (params.topper === 'star') {
    star = new THREE.Group();
    star.name = 'topper';
    const tc = new THREE.Color(params.topperColor);
    const starMat = keep(
      new THREE.MeshStandardMaterial({ color: tc, emissive: tc.clone().lerp(new THREE.Color('#ff8a00'), 0.35), emissiveIntensity: 1.3, metalness: 0.7, roughness: 0.22, flatShading: true })
    );
    starMesh = new THREE.Mesh(keep(topperGeometry()), starMat);
    starMesh.scale.setScalar(K * 0.95);
    star.add(starMesh);
    halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glowTexture(), color: tc, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
    halo.scale.setScalar(1.5 * K);
    star.add(halo);
    if (params.glowLights) {
      const l = new THREE.PointLight(tc.clone().lerp(new THREE.Color('#ffcc77'), 0.6), 6 * K * K, 9 * K, 2);
      inner.push([l, 6]);
      star.add(l);
    }
    star.position.set(0, H + 0.32 * K, 0);
    group.add(star);
  }

  // 5) Warm inner light (bulb glow spilling onto the ground)
  if (params.glowLights && params.lights > 0) {
    const glowCol = lightCols.length > 1 ? '#ffd2a0' : new THREE.Color(...lightCols[0]).getStyle();
    const a = new THREE.PointLight(glowCol, 9 * K * K, 9 * K, 2);
    a.position.set(0, H * 0.25, 0);
    const b = new THREE.PointLight(glowCol, 6 * K * K, 7 * K, 2);
    b.position.set(0, H * 0.55, 0);
    inner.push([a, 9], [b, 6]);
    group.add(a, b);
  }

  // 6) Trunk surround
  let ground = { radius: Math.max(3, tree.trunkRadius * 5), floor: () => 0 };
  if (params.base === 'bed') ground = buildBed(tree, group, keep);
  else if (params.base === 'skirt') ground = buildSkirt(tree, group, keep, params.skirtColor);

  // 7) Presents
  const wraps = [
    ['#b3121f', '#f4ead8'],
    ['#14532d', '#e8c25a'],
    ['#1e3a8a', '#e5e7eb'],
    ['#f4ead8', '#b3121f'],
    ['#6b1a6f', '#e8c25a'],
    ['#c99a2e', '#7a1414'],
  ];
  const presents = new THREE.Group();
  for (let i = 0; i < params.presents; i++) {
    const a = (i / params.presents) * Math.PI * 2 + rand() * 0.4;
    const r = lerp(tree.trunkRadius * 1.9, ground.radius - 0.35, rand());
    const w = (0.28 + rand() * 0.32) * K * 0.6;
    const h = (0.2 + rand() * 0.3) * K * 0.6;
    const d = (0.26 + rand() * 0.3) * K * 0.6;
    const [base, accent] = wraps[Math.floor(rand() * wraps.length)];
    const p = buildPresent(rand, w, h, d, base, accent, Math.floor(rand() * 3));
    const y0 = ground.floor(r) - 0.03;
    p.position.set(Math.cos(a) * r, y0, Math.sin(a) * r);
    p.rotation.y = rand() * Math.PI;
    presents.add(p);
    // sometimes stack a small box on top
    if (rand() < 0.3) {
      const [b2, a2] = wraps[Math.floor(rand() * wraps.length)];
      const small = buildPresent(rand, w * 0.6, h * 0.6, d * 0.6, b2, a2, Math.floor(rand() * 3));
      small.position.set(p.position.x, y0 + h, p.position.z);
      small.rotation.y = rand() * Math.PI;
      presents.add(small);
    }
  }
  // Merge into one mesh per wrap/ribbon type (5 meshes per box -> one per type). Wrap tiling is baked into UVs
  presents.updateMatrixWorld(true);
  const buckets = new Map();
  const freed = new Set();
  presents.traverse((o) => {
    if (!o.isMesh) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    const map = o.material.map;
    if (map) {
      const uv = g.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * map.repeat.x, uv.getY(k) * map.repeat.y);
    }
    const key = o.userData.mergeKey;
    if (!buckets.has(key)) buckets.set(key, { geos: [], mat: o.material });
    const b = buckets.get(key);
    b.geos.push(g.index ? g.toNonIndexed() : g);
    // dispose materials and wrap texture clones left unused after merging
    if (o.material !== b.mat && !freed.has(o.material)) {
      freed.add(o.material);
      o.material.map?.dispose();
      o.material.dispose();
    }
    o.geometry.dispose();
  });
  for (const { geos, mat } of buckets.values()) {
    if (mat.map) {
      mat.map.repeat.set(1, 1);
      mat.map.needsUpdate = true;
    }
    const merged = new THREE.Mesh(keep(mergeGeometries(geos)), keep(mat));
    if (mat.map) keep(mat.map);
    merged.name = 'presents';
    merged.castShadow = true;
    merged.receiveShadow = true;
    group.add(merged);
    for (const g of geos) g.dispose();
  }

  // Per render: ornament LOD, star sway toward the camera, inner light flicker.
  // Distance is in tree design units (switches at the same screen size even when scaled down)
  const baseStar = star?.position.y ?? 0;
  const _c = new THREE.Vector3();
  const _inv = new THREE.Matrix4();
  const perFrame = (camera) => {
    const t = uniforms.uTime.value;
    _inv.copy(group.matrixWorld).invert();
    camera.getWorldPosition(_c).applyMatrix4(_inv);
    const d = Math.hypot(_c.x, _c.y - H * 0.45, _c.z);
    for (const l of ornamentLods) {
      if (l.low === l.high) continue;
      const far = l.mesh.geometry === l.low ? d > H * 1.1 : d > H * 1.25;
      l.mesh.geometry = far ? l.low : l.high;
    }
    if (star) {
      starMesh.rotation.y = Math.atan2(_c.x, _c.z) + Math.sin(t * 0.4) * 0.25;
      star.position.y = baseStar + Math.sin(t * 1.3) * 0.02 * K;
      halo.material.opacity = 0.45 + Math.sin(t * 2.1) * 0.1;
    }
    const flick = 0.92 + Math.sin(t * 7.1) * 0.04 + Math.sin(t * 13.7) * 0.03;
    const ls = api.lightScale;
    for (const [l, base] of inner) {
      l.intensity = ((base * K * K * flick * uniforms.uGlow.value) / 3) * ls * ls;
      l.distance = l.userData.baseDistance * ls;
    }
  };

  for (const [l] of inner) l.userData.baseDistance = l.distance;
  const api = {
    lightScale: 1, // world size / design size
    group,
    params,
    bulbs,
    stats: { ornaments: spots.length, lights: lightSpots.length },
    perFrame,
    dispose() {
      group.traverse((o) => {
        if (o.isMesh && !disposables.includes(o.geometry)) o.geometry.dispose?.();
      });
      for (const d of disposables) d.dispose?.();
    },
  };
  return api;
}
