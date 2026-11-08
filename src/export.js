import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// Export the tree as GLB (for Unity, Godot, Unreal, Blender, etc.).
//   bake: true (default) → bake instances into plain meshes. Godot 4 can't read EXT_mesh_gpu_instancing
//   bake: false      → export with EXT_mesh_gpu_instancing for a smaller file (read by Unity glTFast, three.js, Babylon)
//   needleRatio      → fraction of needle clusters to export (0-1). They're shuffled, so truncating thins them evenly
//   lights           → also include the star and inner point lights as KHR_lights_punctual
//   userOrnaments    → whether to include user-hung ornaments
export async function exportGLB(tree, { bake = true, needleRatio = 1, lights = false, userOrnaments = true, binary = true } = {}) {
  const scene = buildExportScene(tree, { bake, needleRatio, lights, userOrnaments });
  const exporter = new GLTFExporter();
  const out = await exporter.parseAsync(scene, { binary, onlyVisible: true });
  scene.traverse((o) => {
    if (o.isMesh && o.userData.xtkOwned) o.geometry.dispose();
  });
  return out;
}

// Download directly in the browser
export async function downloadGLB(tree, filename = 'christmas-tree.glb', opts) {
  const buf = await exportGLB(tree, opts);
  const url = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return buf.byteLength;
}

// Export scene: all meshes flattened into tree-local coordinates (every node transform is identity)
export function buildExportScene(tree, { bake = true, needleRatio = 1, lights = false, userOrnaments = true } = {}) {
  tree.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(tree.matrixWorld).invert();
  const scene = new THREE.Scene();
  const out = new THREE.Group();
  out.name = 'christmas-tree';
  scene.add(out);
  const rel = new THREE.Matrix4();
  const matCache = new Map();

  tree.root.traverse((o) => {
    if (!o.visible) return;
    if (!userOrnaments && o.parent?.name === 'ornament-layer') return;
    if (o.isLight) {
      if (!lights) return;
      const l = o.clone();
      rel.multiplyMatrices(inv, o.matrixWorld).decompose(l.position, l.quaternion, l.scale);
      l.intensity = o.intensity / 30; // roughly scale down intensity from design units (height 20)
      out.add(l);
      return;
    }
    if (!o.isMesh || o.isSprite) return;
    if (o.material?.visible === false || o.material?.colorWrite === false) return; // invisible surfaces, depth prepass
    let count = o.isInstancedMesh ? o.count : 1;
    if (o.name === 'needles') count = Math.max(1, Math.floor(o.count * needleRatio)); // needles
    if (o.isInstancedMesh && count === 0) return;
    rel.multiplyMatrices(inv, o.matrixWorld);
    const mat = exportMaterial(o, matCache, bake);
    let mesh;
    if (o.isInstancedMesh && bake) {
      mesh = new THREE.Mesh(bakeInstances(o, count, rel), mat);
    } else if (o.isInstancedMesh) {
      mesh = new THREE.InstancedMesh(o.geometry, mat, count);
      for (let i = 0; i < count; i++) {
        o.getMatrixAt(i, _m);
        mesh.setMatrixAt(i, _m);
      }
      if (o.instanceColor) {
        mesh.instanceColor = new THREE.InstancedBufferAttribute(o.instanceColor.array.slice(0, count * 3), 3);
      }
      rel.decompose(mesh.position, mesh.quaternion, mesh.scale);
    } else {
      const g = o.geometry.clone().applyMatrix4(rel);
      mesh = new THREE.Mesh(g, mat);
      mesh.userData.xtkOwned = true;
    }
    if (mesh.geometry !== o.geometry) mesh.userData.xtkOwned = true;
    mesh.name = o.name || 'mesh';
    out.add(mesh);
  });
  return scene;
}

const _m = new THREE.Matrix4();
const _n = new THREE.Matrix3();
const _w = new THREE.Matrix4();
const _v = new THREE.Vector3();

// Bake instances into one geometry. Instance colors become vertex colors
function bakeInstances(mesh, count, rel) {
  const src = mesh.geometry;
  const P = src.attributes.position;
  const N = src.attributes.normal;
  const UV = src.attributes.uv;
  const idx = src.index;
  const vc = P.count;
  const pos = new Float32Array(vc * count * 3);
  const nor = N ? new Float32Array(vc * count * 3) : null;
  const uv = UV ? new Float32Array(vc * count * 2) : null;
  const col = mesh.instanceColor ? new Float32Array(vc * count * 3) : null;
  const ic = idx ? idx.count : 0;
  const index = idx ? new Uint32Array(ic * count) : null;
  for (let i = 0; i < count; i++) {
    mesh.getMatrixAt(i, _m);
    _w.multiplyMatrices(rel, _m);
    _n.getNormalMatrix(_w);
    const o = i * vc;
    for (let k = 0; k < vc; k++) {
      _v.fromBufferAttribute(P, k).applyMatrix4(_w).toArray(pos, (o + k) * 3);
      if (nor) _v.fromBufferAttribute(N, k).applyMatrix3(_n).normalize().toArray(nor, (o + k) * 3);
      if (uv) {
        uv[(o + k) * 2] = UV.getX(k);
        uv[(o + k) * 2 + 1] = UV.getY(k);
      }
      if (col) {
        col[(o + k) * 3] = mesh.instanceColor.getX(i);
        col[(o + k) * 3 + 1] = mesh.instanceColor.getY(i);
        col[(o + k) * 3 + 2] = mesh.instanceColor.getZ(i);
      }
    }
    if (index) for (let k = 0; k < ic; k++) index[i * ic + k] = idx.getX(k) + o;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (nor) g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (uv) g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  if (col) g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  if (index) g.setIndex(new THREE.BufferAttribute(index, 1));
  return g;
}

// Shader patches (snow, twinkle) can't be stored in the file, so swap in standard materials. Bulbs become emissive unlit
function exportMaterial(o, cache, bake) {
  const src = o.material;
  const baked = bake && o.isInstancedMesh && !!o.instanceColor;
  const key = `${src.uuid}|${baked}|${o.name}`;
  if (cache.has(key)) return cache.get(key);
  let mat;
  if (o.name === 'bulbs') {
    mat = new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: baked });
  } else {
    mat = src.clone();
    mat.onBeforeCompile = () => {};
    mat.depthFunc = THREE.LessEqualDepth;
    mat.depthWrite = true;
    mat.alphaToCoverage = false;
    mat.vertexColors = baked || mat.vertexColors;
  }
  mat.name = o.name || src.name;
  cache.set(key, mat);
  return mat;
}
