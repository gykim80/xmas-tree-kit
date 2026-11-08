import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// 트리를 GLB 로 내보낸다 (Unity·Godot·Unreal·Blender 등에서 쓰기).
//   bake: true(기본) → 인스턴스를 보통 메시로 구워 넣는다. Godot 4 는 EXT_mesh_gpu_instancing 을 읽지 못한다
//   bake: false      → EXT_mesh_gpu_instancing 으로 내보내 파일이 작다 (Unity glTFast, three.js, Babylon 은 읽는다)
//   needleRatio      → 잎 묶음 중 내보낼 비율 (0~1). 잎 순서가 섞여 있어 앞에서부터 잘라도 고르게 성겨진다
//   lights           → 별·안쪽 점광원도 KHR_lights_punctual 로 넣는다
//   userOrnaments    → 사람이 단 오너먼트를 넣을지
export async function exportGLB(tree, { bake = true, needleRatio = 1, lights = false, userOrnaments = true, binary = true } = {}) {
  const scene = buildExportScene(tree, { bake, needleRatio, lights, userOrnaments });
  const exporter = new GLTFExporter();
  const out = await exporter.parseAsync(scene, { binary, onlyVisible: true });
  scene.traverse((o) => {
    if (o.isMesh && o.userData.xtkOwned) o.geometry.dispose();
  });
  return out;
}

// 브라우저에서 바로 내려받기
export async function downloadGLB(tree, filename = 'christmas-tree.glb', opts) {
  const buf = await exportGLB(tree, opts);
  const url = URL.createObjectURL(new Blob([buf], { type: 'model/gltf-binary' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return buf.byteLength;
}

// 내보낼 장면: 모든 메시를 트리 기준 좌표로 펴 둔다 (노드 변환은 모두 단위 행렬)
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
      l.intensity = o.intensity / 30; // 설계 단위(높이 20) 기준 세기를 대략 줄인다
      out.add(l);
      return;
    }
    if (!o.isMesh || o.isSprite) return;
    if (o.material?.visible === false || o.material?.colorWrite === false) return; // 보이지 않는 면, 깊이 선행 패스
    let count = o.isInstancedMesh ? o.count : 1;
    if (o.name === 'needles') count = Math.max(1, Math.floor(o.count * needleRatio)); // 바늘잎
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

// 인스턴스를 한 지오메트리로 굽는다. 인스턴스 색은 정점 색으로
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

// 셰이더 패치(눈·깜박임)는 파일에 담을 수 없어 표준 재질로 바꾼다. 전구는 빛나는 무광(unlit)으로
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
