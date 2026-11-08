import * as THREE from 'three';
import { buildTree, TREE_DEFAULTS } from './tree/tree.js';
import { buildDecorations, DECOR_DEFAULTS } from './decor/decorate.js';
import { createOrnamentLayer } from './decor/ornaments.js';
import { createUniforms } from './materials.js';
import { PRESETS, QUALITY } from './presets.js';

export const FORMAT = 'xmas-tree-kit';
export const FORMAT_VERSION = 1;

const TREE_KEYS = new Set(Object.keys(TREE_DEFAULTS));
const _v2 = new THREE.Vector2();

// A single Christmas tree. It's a THREE.Group, so just scene.add(tree).
//
//   const tree = new ChristmasTree({ preset: 'cozy', size: 2.4 });
//   scene.add(tree);
//   tree.addOrnament({ shape: 'star', color: '#f2c14e', h: 0.6, a: 1.2 });
//
// Nothing to call per frame (twinkle, star and LOD update themselves on render)
export class ChristmasTree extends THREE.Group {
  constructor(options = {}) {
    super();
    this.name = 'christmas-tree';
    this.type = 'ChristmasTree';
    this.options = normalize(options);
    this.uniforms = options.uniforms ?? createUniforms();
    this.root = new THREE.Group(); // scales the tree from design units (height 20) to size
    this.root.name = 'tree-root';
    this.add(this.root);
    this.autoTime = options.autoTime ?? true;
    this._t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    this._tree = null;
    this._decor = null;
    this.ornaments = null;
    this.generate();
    for (const o of this.options.ornaments ?? []) this.ornaments.add(o, { animate: false });
    delete this.options.ornaments;
  }

  // Effective values for the current options (preset + user values + quality)
  get resolved() {
    return resolve(this.options);
  }

  // Rebuild the tree and decorations. User-hung ornaments are kept
  generate() {
    const r = resolve(this.options);
    this._disposeTree();
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    this._tree = buildTree(r.tree, this.uniforms, { prepass: r.prepass, lod: r.lod, barkMap: r.barkMap, needleColor: r.needleColor, barkColor: r.barkColor });
    this.root.add(this._tree.group);
    this._buildDecor(r);
    if (this.ornaments) this.ornaments.relayout(this._tree);
    else {
      this.ornaments = createOrnamentLayer(this._tree, { size: r.ornamentScale });
      this.ornaments.hooks.onAdd = (o) => this.dispatchEvent({ type: 'ornamentadd', ornament: o });
      this.ornaments.hooks.onRemove = (o) => this.dispatchEvent({ type: 'ornamentremove', ornament: o });
      this.ornaments.hooks.onArrive = (o) => this.dispatchEvent({ type: 'ornamentarrive', ornament: o });
      this.root.add(this.ornaments.group);
    }
    this._applyLook(r);
    this._hookFrame();
    this.buildTime = (typeof performance !== 'undefined' ? performance.now() : 0) - t0;
    this.dispatchEvent({ type: 'generate' });
    return this;
  }

  // Update some options. Only rebuilds what changed (shader values: instant, decor: decor only, shape: everything)
  set(patch = {}) {
    const prev = resolve(this.options);
    const o = this.options;
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'tree' || k === 'decor') o[k] = { ...o[k], ...v };
      else if (k === 'ornaments') continue;
      else o[k] = v;
    }
    if ('preset' in patch && !patch.tree) o.tree = { ...(patch.tree ?? {}) };
    if ('preset' in patch && !patch.decor) o.decor = { ...(patch.decor ?? {}) };
    const next = resolve(o);
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    if (!same(prev.tree, next.tree) || prev.prepass !== next.prepass || prev.lod !== next.lod || prev.needleColor !== next.needleColor || prev.barkColor !== next.barkColor) this.generate();
    else {
      if (!same(prev.decor, next.decor)) this._buildDecor(next), this._hookFrame();
      this._applyLook(next);
    }
    return this;
  }

  loadPreset(name) {
    return this.set({ preset: name, tree: {}, decor: {} });
  }

  // Final height (m)
  get size() {
    return this.options.size;
  }
  set size(v) {
    this.set({ size: v });
  }
  get snow() {
    return this.uniforms.uSnow.value;
  }
  set snow(v) {
    this.options.snow = v;
    this.uniforms.uSnow.value = v;
  }
  get glow() {
    return this.uniforms.uGlow.value;
  }
  set glow(v) {
    this.options.glow = v;
    this.uniforms.uGlow.value = v;
  }
  get twinkle() {
    return this.uniforms.uTwinkle.value;
  }
  set twinkle(v) {
    this.options.twinkle = v;
    this.uniforms.uTwinkle.value = v;
  }

  // Collision dimensions for games (world size, excluding the tree's own scale)
  get footprint() {
    const s = this._scale;
    let crown = 0;
    for (let y = 0; y <= this._tree.height; y += this._tree.height / 24) crown = Math.max(crown, this._tree.envAt(y));
    return { height: this.options.size, trunkRadius: this._tree.trunkRadius * s * 1.6, crownRadius: crown * s };
  }

  get stats() {
    return { ...this._tree.stats, ...this._decor.stats, userOrnaments: this.ornaments.count, buildMs: Math.round(this.buildTime) };
  }

  // Ornament shortcuts
  addOrnament(o, opts) {
    return this.ornaments.add(o, opts);
  }
  removeOrnament(id) {
    return this.ornaments.remove(id);
  }
  pickOrnament(ndcOrRay, camera) {
    return this.ornaments.pick(ndcOrRay, camera);
  }
  surfacePoint(ndcOrRay, camera) {
    return this.ornaments.surfacePoint(ndcOrRay, camera);
  }
  // World position of an ornament
  ornamentPosition(o, target = new THREE.Vector3()) {
    this.ornaments.toLocal(this.ornaments.get(o.id ?? o) ?? o, target);
    return this.ornaments.group.localToWorld(target);
  }

  // Passing a time (seconds) disables the automatic clock from then on
  update(time) {
    if (typeof time === 'number') {
      if (this.autoTime) this.ornaments.setClock(() => this.uniforms.uTime.value);
      this.autoTime = false;
      this.uniforms.uTime.value = time;
    }
    this.ornaments.update();
  }

  // Save: only the preset name, user-changed values and hung ornaments
  toJSON() {
    const o = this.options;
    const out = { format: FORMAT, version: FORMAT_VERSION, preset: o.preset, size: o.size, quality: o.quality };
    if (Object.keys(o.tree).length) out.tree = { ...o.tree };
    if (Object.keys(o.decor).length) out.decor = { ...o.decor };
    for (const k of ['snow', 'glow', 'twinkle']) if (o[k] != null) out[k] = o[k];
    out.ornaments = this.ornaments.toJSON();
    return out;
  }

  static fromJSON(json, extra = {}) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (data.format && data.format !== FORMAT) throw new Error(`xmas-tree-kit: unknown format ${data.format}`);
    const { format, version, ...rest } = data;
    return new ChristmasTree({ ...rest, ...extra });
  }

  dispose() {
    this._disposeTree();
    this.ornaments?.dispose();
    this.root.clear();
  }

  // ── internal ──
  get _scale() {
    return this.options.size / this._tree.height;
  }

  _buildDecor(r) {
    if (this._decor) {
      this.root.remove(this._decor.group);
      this._decor.dispose();
    }
    this._decor = buildDecorations(this._tree, r.decor, this.uniforms);
    this.root.add(this._decor.group);
  }

  _applyLook(r) {
    this.root.scale.setScalar(r.size / this._tree.height);
    this._decor.lightScale = r.size / this._tree.height;
    this.uniforms.uSnow.value = r.snow;
    this.uniforms.uGlow.value = r.glow;
    this.uniforms.uTwinkle.value = r.twinkle;
    const shadows = r.shadows;
    this.root.traverse((o) => {
      if (!o.isMesh || o.name === 'bulbs') return;
      if (o.userData.xtkShadow == null) o.userData.xtkShadow = o.castShadow;
      o.castShadow = shadows && o.userData.xtkShadow;
    });
  }

  _disposeTree() {
    if (this._decor) {
      this.root.remove(this._decor.group);
      this._decor.dispose();
      this._decor = null;
    }
    if (this._tree) {
      this.root.remove(this._tree.group);
      this._tree.dispose();
      this._tree = null;
    }
  }

  // Once per bark render: clock, minimum bulb size, decor LOD, ornament motion
  _hookFrame() {
    const bark = this._tree.barkMesh;
    bark.onBeforeRender = (renderer, _scene, camera) => {
      if (camera.userData.isMirror) return;
      if (this.autoTime) this.uniforms.uTime.value = (performance.now() - this._t0) / 1000;
      if (camera.isPerspectiveCamera) {
        const rt = renderer.getRenderTarget();
        const h = rt ? rt.height : renderer.getDrawingBufferSize(_v2).y;
        this.uniforms.uPx.value = (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / Math.max(1, h) / camera.zoom;
      }
      this._decor.perFrame(camera);
      this.ornaments.update();
    };
  }
}

// Normalize options: tree shape values may also be given at the top level (seed, height, etc.)
function normalize(options) {
  const { uniforms, autoTime, tree = {}, decor = {}, ...rest } = options;
  const o = {
    preset: 'classic',
    size: 2.4,
    quality: 'high',
    tree: { ...tree },
    decor: { ...decor },
    ...rest,
  };
  for (const k of Object.keys(rest)) {
    // ornaments as an array means user-hung ornaments; as a number, the auto-decor count
    if (k === 'ornaments' && Array.isArray(rest[k])) continue;
    if (TREE_KEYS.has(k)) {
      o.tree[k] = rest[k];
      delete o[k];
    } else if (k in DECOR_DEFAULTS) {
      o.decor[k] = rest[k];
      delete o[k];
    }
  }
  return o;
}

export function resolve(o) {
  const preset = PRESETS[o.preset] ?? PRESETS.classic;
  const q = QUALITY[o.quality] ?? QUALITY.high;
  const tree = { ...TREE_DEFAULTS, ...preset.tree, ...o.tree };
  // quality never overrides values the user set explicitly
  const ut = o.tree ?? {};
  if (ut.whorls == null) tree.whorls = Math.max(8, Math.round(tree.whorls * q.whorls));
  if (ut.branchesPerWhorl == null) tree.branchesPerWhorl = Math.max(4, Math.round(tree.branchesPerWhorl * q.branchesPerWhorl));
  if (ut.twigs == null) tree.twigs *= q.twigs;
  if (ut.needles == null) tree.needles *= q.needles;
  if (ut.needleSize == null) tree.needleSize *= q.needleSize;
  const decor = { ...DECOR_DEFAULTS, ...preset.decor, ...o.decor };
  const ud = o.decor ?? {};
  if (ud.lights == null) decor.lights = Math.round(decor.lights * q.lights);
  if (ud.ornaments == null) decor.ornaments = Math.round(decor.ornaments * q.ornaments);
  return {
    tree,
    decor,
    size: o.size ?? 2.4,
    snow: o.snow ?? preset.snow ?? 0.5,
    glow: o.glow ?? 3,
    twinkle: o.twinkle ?? 2.2,
    shadows: o.shadows ?? true,
    prepass: !!o.prepass,
    lod: o.lod ?? true,
    ornamentScale: o.ornamentScale ?? 1,
    barkMap: o.barkMap,
    needleColor: o.needleColor,
    barkColor: o.barkColor,
  };
}
