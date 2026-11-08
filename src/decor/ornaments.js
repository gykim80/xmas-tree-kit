import * as THREE from 'three';
import { clamp } from '../core/rng.js';
import { ORNAMENT_SHAPES, ornamentGeometry } from './shapes.js';

// Layer of user-hung ornaments. One InstancedMesh per shape, colors via instance color.
// Positions are { h: height fraction 0-1, a: angle (radians), r: radius relative to the outer surface }.
// They reattach at the same spot on the outer surface when the tree's size or shape changes
const CAP = 2048;
let nextId = 1;

export function createOrnamentLayer(tree, { size = 1, capacity = CAP } = {}) {
  const group = new THREE.Group();
  group.name = 'ornament-layer';
  let shape = tree; // { height, envAt, crownBase }
  const base = () => 0.2 * (shape.height / 20); // radius 0.2 at design height 20
  const geos = ORNAMENT_SHAPES.map((k) => ornamentGeometry(k));
  const mat = new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.55, roughness: 0.28, envMapIntensity: 2.2 });
  // slight emissive instance color so colors read at night
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.32;');
  };
  mat.customProgramCacheKey = () => 'xtk-ornament';
  const meshes = geos.map((g, k) => {
    const m = new THREE.InstancedMesh(g, mat, capacity);
    m.name = `user-ornaments-${ORNAMENT_SHAPES[k]}`;
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = true;
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
    group.add(m);
    return m;
  });
  const slots = meshes.map(() => []); // per-shape instance index -> ornament
  const byId = new Map();
  const hooks = { onAdd: null, onRemove: null, onArrive: null };

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _e = new THREE.Euler();
  const _p = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _c = new THREE.Color();

  // Normalized position -> tree design coordinates
  function toLocal(o, out = new THREE.Vector3()) {
    const y = clamp(o.h, 0, 1) * shape.height;
    const rad = shape.envAt(y) * (o.r ?? 0.92);
    return out.set(Math.cos(o.a) * rad, y, Math.sin(o.a) * rad);
  }
  // Tree design coordinates -> normalized position
  function fromLocal(p) {
    const y = clamp(p.y, 0, shape.height);
    const env = Math.max(0.05, shape.envAt(y));
    return { h: y / shape.height, a: Math.atan2(p.z, p.x), r: clamp(Math.hypot(p.x, p.z) / env, 0, 1.2) };
  }

  function place(o, scale = 1, at = null, spin = 0) {
    const k = ORNAMENT_SHAPES.indexOf(o.shape);
    const i = slots[k].indexOf(o);
    if (i < 0) return;
    const p = at ?? toLocal(o, _p);
    _e.set(0, Math.atan2(p.x, p.z) + spin, 0); // face outward
    _q.setFromEuler(_e);
    const s = base() * (o.size ?? 1) * size * scale;
    _m.compose(p, _q, _s.set(s, s, s));
    meshes[k].setMatrixAt(i, _m);
    meshes[k].setColorAt(i, _c.set(o.color));
    meshes[k].instanceMatrix.needsUpdate = true;
    meshes[k].instanceColor.needsUpdate = true;
    // force picking (raycast) bounds to be recomputed
    meshes[k].boundingSphere = null;
    meshes[k].boundingBox = null;
  }

  // Hang an ornament. With from (world Vector3), it rises from there and flies into place
  function add(input, { from = null, animate = true } = {}) {
    const o = {
      id: input.id ?? `o${nextId++}`,
      shape: ORNAMENT_SHAPES.includes(input.shape) ? input.shape : 'ball',
      color: input.color ?? '#e23b3b',
      h: input.h ?? 0.5,
      a: input.a ?? 0,
      r: input.r ?? 0.92,
      size: input.size ?? 1,
      data: input.data ?? null,
    };
    if (byId.has(o.id)) remove(o.id);
    const k = ORNAMENT_SHAPES.indexOf(o.shape);
    if (meshes[k].count >= capacity) return null;
    slots[k].push(o);
    meshes[k].count = slots[k].length;
    byId.set(o.id, o);
    if (from) {
      const to = toLocal(o);
      const p0 = group.worldToLocal(from.clone());
      const out = new THREE.Vector3(to.x, 0, to.z).normalize();
      const H = shape.height;
      // rise up, then swing in from outside the tree and settle into place
      const p1 = p0.clone().add(new THREE.Vector3(0, H * 0.16, 0));
      const p2 = to.clone().addScaledVector(out, H * 0.15).add(new THREE.Vector3(0, H * 0.08, 0));
      const dur = clamp(1.5 + (p0.distanceTo(to) / H) * 1, 1.7, 2.8);
      o._fly = { p0, p1, p2, p3: to, t0: now(), dur };
      place(o, 2.2, p0);
    } else if (animate) {
      o._born = now();
      place(o, 0.01);
    } else place(o);
    hooks.onAdd?.(o);
    return o;
  }

  function remove(id) {
    const o = byId.get(id);
    if (!o) return false;
    const k = ORNAMENT_SHAPES.indexOf(o.shape);
    const list = slots[k];
    const i = list.indexOf(o);
    // move the last instance into the freed slot
    const last = list.pop();
    if (last !== o) {
      list[i] = last;
      place(last);
    }
    meshes[k].count = list.length;
    meshes[k].boundingSphere = null;
    meshes[k].boundingBox = null;
    byId.delete(id);
    if (lit === o) lit = null;
    hooks.onRemove?.(o);
    return true;
  }

  function clear() {
    for (const id of [...byId.keys()]) remove(id);
  }

  // Re-place ornaments after the tree is regrown
  function relayout(nextShape) {
    shape = nextShape;
    for (const o of byId.values()) place(o);
  }

  const bez = (a, b, c, d, t, out) => {
    const u = 1 - t;
    return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
  };
  // Clock: real time by default. setClock lets you drive time directly, e.g. for screen recording
  let clock = () => performance.now() / 1000;
  const now = () => clock();
  const _f = new THREE.Vector3();
  let lit = null; // highlighted ornament (gentle pulse)

  // only animate ornaments in flight, just hung (pop), or highlighted
  function update() {
    const t1 = now();
    for (const o of byId.values()) {
      if (o._fly) {
        const t = Math.min(1, (t1 - o._fly.t0) / o._fly.dur);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        bez(o._fly.p0, o._fly.p1, o._fly.p2, o._fly.p3, e, _f);
        _f.y += Math.sin(t * Math.PI * 3) * 0.008 * shape.height * (1 - t);
        place(o, 2.2 - 1.2 * e, _f, (1 - e) * Math.PI * 4);
        if (t >= 1) {
          o._fly = null;
          o._born = t1;
          hooks.onArrive?.(o);
        }
      } else if (o._born) {
        const t = Math.min(1, (t1 - o._born) / 0.6);
        place(o, Math.max(0.01, 1 + Math.sin(t * Math.PI) * 0.6 * (1 - t)));
        if (t >= 1) o._born = 0;
      }
    }
    if (lit && !lit._fly && !lit._born) place(lit, 1.25 + Math.sin(t1 * 5) * 0.12);
  }

  function highlight(o) {
    if (lit && lit !== o && byId.has(lit.id)) place(lit);
    lit = o ? byId.get(o.id ?? o) ?? null : null;
  }

  const ray = new THREE.Raycaster();
  const setRay = (a, camera) => (a instanceof THREE.Raycaster ? a : (ray.setFromCamera(a, camera), ray));

  // Pick a hung ornament by screen coordinates (NDC Vector2) or a Raycaster
  function pick(ndcOrRay, camera) {
    const r = setRay(ndcOrRay, camera);
    const hit = r.intersectObjects(meshes.filter((m) => m.count > 0), false)[0];
    if (!hit) return null;
    return slots[meshes.indexOf(hit.object)][hit.instanceId] ?? null;
  }

  // Hanging surface: an invisible lathe that follows the tree's outer surface
  let proxy = null;
  function buildProxy() {
    if (proxy) {
      group.remove(proxy);
      proxy.geometry.dispose();
    }
    const prof = [];
    const H = shape.height;
    const y0 = shape.crownBase * 0.9;
    for (let i = 0; i <= 40; i++) {
      const y = y0 + (i / 40) * (H * 0.97 - y0);
      prof.push(new THREE.Vector2(shape.envAt(y) * 0.92 + 0.02, y));
    }
    proxy = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), proxyMat);
    proxy.name = 'ornament-surface';
    group.add(proxy);
  }
  const proxyMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
  buildProxy();

  // Find a spot on the tree's outer surface from screen coordinates. Returns { h, a, r, point (world) } or null
  function surfacePoint(ndcOrRay, camera) {
    const r = setRay(ndcOrRay, camera);
    const hit = r.intersectObject(proxy, false)[0];
    if (!hit) return null;
    const local = group.worldToLocal(hit.point.clone());
    return { ...fromLocal(local), r: 0.92, point: hit.point.clone() };
  }

  // Translucent preview shown while picking a spot
  const ghostMat = new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0.8, depthWrite: false });
  const ghost = new THREE.Mesh(geos[0], ghostMat);
  ghost.name = 'ornament-ghost';
  ghost.visible = false;
  group.add(ghost);
  function preview(spot, shapeName = 'ball', color = '#ffffff') {
    ghost.visible = !!spot;
    if (!spot) return;
    ghost.geometry = geos[Math.max(0, ORNAMENT_SHAPES.indexOf(shapeName))];
    ghostMat.color.set(color);
    toLocal(spot, ghost.position);
    ghost.rotation.set(0, Math.atan2(ghost.position.x, ghost.position.z), 0);
    ghost.scale.setScalar(base() * size * (1.15 + Math.sin(now() * 8) * 0.12));
  }

  const serialize = (o) => {
    const out = { id: o.id, shape: o.shape, color: o.color, h: +o.h.toFixed(4), a: +o.a.toFixed(4) };
    if (o.r !== 0.92) out.r = +o.r.toFixed(3);
    if (o.size !== 1) out.size = o.size;
    if (o.data != null) out.data = o.data;
    return out;
  };

  return {
    group,
    hooks,
    add,
    remove,
    clear,
    get: (id) => byId.get(id) ?? null,
    list: () => [...byId.values()],
    get count() {
      return byId.size;
    },
    pick,
    surfacePoint,
    preview,
    highlight,
    relayout(next) {
      relayout(next);
      buildProxy();
    },
    toLocal,
    update,
    setClock(fn) {
      clock = fn ?? (() => performance.now() / 1000);
    },
    toJSON: () => [...byId.values()].map(serialize),
    dispose() {
      for (const g of geos) g.dispose();
      for (const m of meshes) m.dispose();
      proxy?.geometry.dispose();
      mat.dispose();
      ghostMat.dispose();
      proxyMat.dispose();
    },
  };
}
