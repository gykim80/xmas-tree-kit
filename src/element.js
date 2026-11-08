import { createViewer } from './viewer.js';
import { ChristmasTree } from './christmas-tree.js';
import { ORNAMENT_SHAPES } from './decor/shapes.js';

// <xmas-tree> 웹 컴포넌트. 속성 이름은 model-viewer 처럼 케밥 표기, 켜고 끄는 속성은 있으면 켜짐.
//
//   <xmas-tree preset="cozy" auto-rotate camera-controls snowfall style="height:480px"></xmas-tree>
//   <xmas-tree src="/my-tree.json" decorate ornament-shape="star"></xmas-tree>
//
// 트리 속성: preset seed size quality palette light-color lights ornaments presents topper base
//           garland beads snow glow twinkle
// 화면 속성: background(night·evening·day·transparent·#색) auto-rotate camera-controls snowfall ground shadows
// 꾸미기:   decorate(누르면 오너먼트를 건다) ornament-shape ornament-color
// 이벤트:   load, ornamentadd, ornamentremove (detail.ornament, detail.tree)
const TREE_ATTRS = ['preset', 'seed', 'size', 'quality', 'palette', 'light-color', 'lights', 'ornaments', 'presents', 'topper', 'base', 'garland', 'beads', 'snow', 'glow', 'twinkle'];
const VIEW_ATTRS = ['background', 'auto-rotate', 'camera-controls', 'snowfall', 'ground', 'shadows'];
const NUM = new Set(['seed', 'size', 'lights', 'ornaments', 'presents', 'snow', 'glow', 'twinkle']);
const BOOL_TREE = new Set(['garland', 'beads']);
const LIVE = new Set(['snow', 'glow', 'twinkle']); // 다시 만들지 않고 바로 바뀌는 값

const COLORS = ['#e23b3b', '#f2c14e', '#3fa4ff', '#36c27a', '#c46cff', '#ff8fc7', '#f4f4f4'];
// ground 속성: 없으면 켜짐, "false" 면 꺼짐, 색을 적으면 그 색 바닥
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

  // 트리 옵션 (속성으로 다 못 적는 값을 넘길 때). 저장한 JSON 을 그대로 넣어도 된다
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
        console.warn('xmas-tree: src 를 읽지 못했습니다', e);
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

  // decorate 속성: 트리를 누르면 오너먼트를 걸고, 걸린 오너먼트를 누르면 떼어 낸다 (Shift+누르기)
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
      // 끌어서 돌린 것은 누르기로 치지 않는다
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
  // 색을 안 정하면 누를 때마다 바꾼다 (미리보기와 건 것이 같은 색이 되게 다음 색을 미리 정해 둔다)
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
