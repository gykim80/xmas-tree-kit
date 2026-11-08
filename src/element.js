import { createViewer } from './viewer.js';
import { ChristmasTree } from './christmas-tree.js';
import { ORNAMENT_SHAPES } from './decor/shapes.js';

// <xmas-tree> web component. Attribute names are kebab-case like model-viewer; boolean attributes are on when present.
//
//   <xmas-tree preset="cozy" auto-rotate camera-controls snowfall style="height:480px"></xmas-tree>
//   <xmas-tree src="/my-tree.json" decorate ornament-shape="star"></xmas-tree>
//
// Tree:   preset seed size quality palette light-color lights ornaments presents topper base
//         garland beads snow glow twinkle
// View:   background(night|evening|day|transparent|#color) auto-rotate camera-controls snowfall ground shadows
// Decor:  decorate(click to hang an ornament) ornament-shape ornament-color
// Events: load, ornamentadd, ornamentremove (detail.ornament, detail.tree)
const TREE_ATTRS = ['preset', 'seed', 'size', 'quality', 'palette', 'light-color', 'lights', 'ornaments', 'presents', 'topper', 'base', 'garland', 'beads', 'snow', 'glow', 'twinkle'];
const VIEW_ATTRS = ['background', 'auto-rotate', 'camera-controls', 'snowfall', 'ground', 'shadows'];
const NUM = new Set(['seed', 'size', 'lights', 'ornaments', 'presents', 'snow', 'glow', 'twinkle']);
const BOOL_TREE = new Set(['garland', 'beads']);
const LIVE = new Set(['snow', 'glow', 'twinkle']); // values applied live without a rebuild

const COLORS = ['#e23b3b', '#f2c14e', '#3fa4ff', '#36c27a', '#c46cff', '#ff8fc7', '#f4f4f4'];
// ground attribute: on when absent, off when "false", a color sets the ground color
const groundAttr = (v) => (v === null || v === '' ? true : v === 'false' ? false : v);
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const HTMLElementBase = typeof HTMLElement !== 'undefined' ? HTMLElement : class {};

export class XmasTreeElement extends HTMLElementBase {
  static get observedAttributes() {
    return [...TREE_ATTRS, ...VIEW_ATTRS, 'src', 'decorate', 'ornament-shape', 'ornament-color'];
  }

  constructor() {
    super();
    this.viewer = null;
    this._json = null;
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>
      :host { display:block; position:relative; width:100%; height:420px; contain:content; }
      .stage { position:absolute; inset:0; }
      :host([decorate]) .stage { cursor:crosshair; }
    </style><div class="stage" part="stage"></div>`;
    this._stage = root.querySelector('.stage');
  }

  get tree() {
    return this.viewer?.tree ?? null;
  }

  // Tree options (for values attributes can't express). Saved JSON works as-is
  set config(v) {
    this._json = v;
    if (this.viewer) this._rebuild();
  }
  get config() {
    return this.tree?.toJSON() ?? this._json;
  }

  toJSON() {
    return this.tree?.toJSON() ?? null;
  }
  toBlob(type) {
    return this.viewer?.toBlob(type);
  }
  exportGLB(opts) {
    return this.viewer?.exportGLB(opts);
  }
  downloadGLB(name, opts) {
    return this.viewer?.downloadGLB(name, opts);
  }

  async connectedCallback() {
    if (this.viewer) return;
    const src = this.getAttribute('src');
    if (src && !this._json) {
      try {
        this._json = await (await fetch(src)).json();
      } catch (e) {
        console.warn('xmas-tree: failed to load src', e);
      }
    }
    if (!this.isConnected || this.viewer) return;
    const has = (n) => this.hasAttribute(n) && this.getAttribute(n) !== 'false';
    this.viewer = createViewer(this._stage, {
      background: this.getAttribute('background') || 'night',
      autoRotate: has('auto-rotate'),
      controls: has('camera-controls'),
      snowfall: has('snowfall'),
      ground: groundAttr(this.getAttribute('ground')),
      shadows: this.getAttribute('shadows') !== 'false',
      ...this._treeOptions(),
    });
    this._bindTree();
    this._bindPointer();
    this.dispatchEvent(new CustomEvent('load', { detail: { tree: this.tree } }));
  }

  disconnectedCallback() {
    this.viewer?.dispose();
    this.viewer = null;
  }

  attributeChangedCallback(name, old, value) {
    if (!this.viewer || old === value) return;
    if (LIVE.has(name)) {
      this.tree[name] = Number(value);
      return;
    }
    if (name === 'background') return this.viewer.setBackground(value || 'night');
    if (name === 'auto-rotate' && this.viewer.controls) {
      this.viewer.autoRotate = value !== null;
      this.viewer.controls.autoRotate = value !== null;
      return;
    }
    if (TREE_ATTRS.includes(name)) {
      const o = this._treeOptions();
      this.tree.set(o);
      if (name === 'size') this.viewer.frame();
      return;
    }
    if (name === 'src') {
      this._json = null;
      this.disconnectedCallback();
      this.connectedCallback();
    }
  }

  _treeOptions() {
    const base = this._json ? { ...this._json } : {};
    const out = { ...base, tree: { ...(base.tree ?? {}) }, decor: { ...(base.decor ?? {}) } };
    for (const a of TREE_ATTRS) {
      if (!this.hasAttribute(a)) continue;
      let v = this.getAttribute(a);
      if (NUM.has(a)) v = Number(v);
      if (BOOL_TREE.has(a)) v = v !== 'false';
      const k = camel(a);
      if (k === 'seed') out.tree.seed = v;
      else if (['palette', 'lightColor', 'lights', 'ornaments', 'presents', 'topper', 'base', 'garland', 'beads'].includes(k)) out.decor[k] = v;
      else out[k] = v;
    }
    return out;
  }

  _rebuild() {
    this.viewer.setTree(this._treeOptions());
    this._bindTree();
  }

  _bindTree() {
    const t = this.tree;
    const fwd = (type) => (e) => this.dispatchEvent(new CustomEvent(type, { detail: { ornament: e.ornament, tree: t } }));
    t.addEventListener('ornamentadd', fwd('ornamentadd'));
    t.addEventListener('ornamentremove', fwd('ornamentremove'));
  }

  // decorate attribute: click the tree to hang an ornament, Shift+click an ornament to remove it
  _bindPointer() {
    const el = this.viewer.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', (e) => (down = [e.clientX, e.clientY]));
    el.addEventListener('pointermove', (e) => {
      if (!this.hasAttribute('decorate')) return;
      const spot = this.tree.surfacePoint(this.viewer.ndc(e.clientX, e.clientY), this.viewer.camera);
      this.tree.ornaments.preview(spot, this._shape(), this._color());
    });
    el.addEventListener('pointerleave', () => this.tree?.ornaments.preview(null));
    el.addEventListener('pointerup', (e) => {
      if (!this.hasAttribute('decorate') || !down) return;
      // a drag to rotate doesn't count as a click
      if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
      const ndc = this.viewer.ndc(e.clientX, e.clientY);
      if (e.shiftKey) {
        const hit = this.tree.pickOrnament(ndc, this.viewer.camera);
        if (hit) this.tree.removeOrnament(hit.id);
        return;
      }
      const spot = this.tree.surfacePoint(ndc, this.viewer.camera);
      if (!spot) return;
      this.tree.addOrnament({ shape: this._shape(), color: this._color(), h: spot.h, a: spot.a });
      this._next = null;
      this._nextShape = null;
    });
  }

  _shape() {
    const s = this.getAttribute('ornament-shape');
    if (ORNAMENT_SHAPES.includes(s)) return s;
    if (!this._nextShape) this._nextShape = ORNAMENT_SHAPES[Math.floor(Math.random() * ORNAMENT_SHAPES.length)];
    return this._nextShape;
  }
  // With no color set, cycle colors per click (pick the next color ahead so the preview matches what gets hung)
  _color() {
    if (!this._next) this._next = COLORS[Math.floor(Math.random() * COLORS.length)];
    return this.getAttribute('ornament-color') || this._next;
  }
}

export function defineXmasTree(tag = 'xmas-tree') {
  if (typeof customElements === 'undefined' || customElements.get(tag)) return;
  customElements.define(tag, class extends XmasTreeElement {});
}

export { ChristmasTree };
