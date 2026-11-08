import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { lerp } from '../core/rng.js';

// Ornament shapes. All roughly radius 1, hanging loop toward +Y
export const ORNAMENT_SHAPES = ['ball', 'drop', 'star', 'bell', 'heart', 'snowflake'];

// Drop (elongated downward)
function dropGeometry(radial) {
  const pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const y = lerp(-1.6, 1, t);
    const r = t < 0.62 ? Math.sin((t / 0.62) * Math.PI * 0.5) ** 0.7 : Math.cos(((t - 0.62) / 0.38) * Math.PI * 0.5);
    pts.push(new THREE.Vector2(Math.max(0.001, r * (t < 0.62 ? 0.75 + t * 0.4 : 1)), y));
  }
  return new THREE.LatheGeometry(pts, radial);
}

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.45 : 1;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2 });
  g.center();
  return g;
}

function heartGeometry() {
  const h = new THREE.Shape();
  h.moveTo(0, -1);
  h.bezierCurveTo(1.3, -0.1, 0.9, 0.95, 0, 0.45);
  h.bezierCurveTo(-0.9, 0.95, -1.3, -0.1, 0, -1);
  const g = new THREE.ExtrudeGeometry(h, { depth: 0.35, bevelEnabled: true, bevelSize: 0.1, bevelThickness: 0.1, bevelSegments: 2 });
  g.center();
  return g;
}

function bellGeometry() {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2((0.18 + 0.82 * Math.pow(t, 2.2)) * (t > 0.92 ? 1.08 : 1), 1 - t * 1.6));
  }
  const g = new THREE.LatheGeometry(pts, 18);
  const clapper = new THREE.SphereGeometry(0.22, 10, 8).translate(0, -0.62, 0);
  const merged = mergeGeometries([g.toNonIndexed(), clapper.toNonIndexed()]);
  merged.center();
  return merged;
}

function snowflakeGeometry() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const b = new THREE.BoxGeometry(2, 0.16, 0.12);
    b.rotateZ((i / 3) * Math.PI);
    parts.push(b);
    for (const d of [-1, 1]) {
      const twig = new THREE.BoxGeometry(0.5, 0.1, 0.1);
      twig.rotateZ(0.8);
      twig.translate(0.6 * d, 0.15, 0);
      twig.rotateZ((i / 3) * Math.PI);
      parts.push(twig);
    }
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}

// detail: 'high' | 'low' (low-res for distance)
export function ornamentGeometry(shape, detail = 'high') {
  const low = detail === 'low';
  switch (shape) {
    case 'drop':
      return dropGeometry(low ? 9 : 20);
    case 'star':
      return starGeometry();
    case 'bell':
      return bellGeometry();
    case 'heart':
      return heartGeometry();
    case 'snowflake':
      return snowflakeGeometry();
    default:
      return low ? new THREE.SphereGeometry(1, 10, 7) : new THREE.SphereGeometry(1, 18, 12);
  }
}

// Shapes that get a metal cap
export const HAS_CAP = new Set(['ball', 'drop']);
