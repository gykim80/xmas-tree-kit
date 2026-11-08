import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, lerp, clamp } from '../core/rng.js';
import { needleTexture, needleNormalTexture, barkTexture } from '../textures.js';
import { addSnow } from '../materials.js';
import { prepassMaterial, equalDepthMaterial, attachPrepass } from '../prepass.js';

// 트리 형태 기본값. 모든 형태는 seed 로 재현된다.
// 길이 단위는 '설계 단위'다. 높이 20 짜리로 키운 뒤 ChristmasTree 의 size 로 원하는 미터 크기로 줄인다
export const TREE_DEFAULTS = {
  seed: 1225,
  height: 20, // 설계 높이. 바꾸면 가지 길이와 잎 크기는 그대로라 비율이 달라진다
  trunkRadius: 0.62,
  clearTrunk: 3.2, // 가지 없이 드러나는 밑동 높이
  whorls: 56, // 가지 층 수
  branchesPerWhorl: 10, // 층마다 가지 수
  spread: 7.0, // 맨 아래 가지 길이
  droop: 0.36, // 가지 처짐
  upturn: 0.55, // 가지 끝 들림
  twigs: 1.0, // 잔가지 밀도
  needles: 1.0, // 바늘잎 밀도
  needleSize: 1.55,
  segLen: 0.34, // 가지 마디 길이
};

const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);

// 경로를 따라 굵기가 줄어드는 관을 만든다 (평행 이동 프레임)
class TubeBuilder {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.uv = [];
    this.idx = [];
  }

  add(points, radii, radial) {
    const base = this.pos.length / 3;
    const n = points.length;
    let tangent = new THREE.Vector3().subVectors(points[1], points[0]).normalize();
    const ref = Math.abs(tangent.y) < 0.9 ? UP : X_AXIS;
    const normal = new THREE.Vector3().crossVectors(tangent, ref).normalize();
    const binormal = new THREE.Vector3().crossVectors(tangent, normal);
    const nt = new THREE.Vector3();
    const axis = new THREE.Vector3();
    let v = 0;
    for (let i = 0; i < n; i++) {
      if (i > 0) {
        nt.subVectors(points[Math.min(i + 1, n - 1)], points[i - 1]).normalize();
        axis.crossVectors(tangent, nt);
        const len = axis.length();
        if (len > 1e-6) normal.applyAxisAngle(axis.divideScalar(len), Math.acos(clamp(tangent.dot(nt), -1, 1)));
        tangent = nt.clone();
        binormal.crossVectors(tangent, normal).normalize();
        normal.crossVectors(binormal, tangent).normalize();
        v += points[i].distanceTo(points[i - 1]);
      }
      const p = points[i];
      const r = radii[i];
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const nx = normal.x * c + binormal.x * s;
        const ny = normal.y * c + binormal.y * s;
        const nz = normal.z * c + binormal.z * s;
        this.pos.push(p.x + nx * r, p.y + ny * r, p.z + nz * r);
        this.nor.push(nx, ny, nz);
        this.uv.push(j / radial, v * 1.5);
      }
    }
    const ring = radial + 1;
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < radial; j++) {
        const a = base + i * ring + j;
        const b = a + ring;
        this.idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
    }
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

// 바늘잎 묶음: 수평 판(+Y 법선)과 수직 판을 엇갈려 부피를 준다
function needleClusterGeometry() {
  const a = new THREE.PlaneGeometry(1, 0.5);
  a.rotateX(-Math.PI / 2);
  a.translate(0.5, 0, 0);
  const b = new THREE.PlaneGeometry(1, 0.32);
  b.translate(0.5, 0, 0);
  return mergeGeometries([a, b]);
}

// 트리 한 그루를 키운다
// opts: { barkMap, needleColor, barkColor, prepass, lod }
export function buildTree(input = {}, sharedUniforms, opts = {}) {
  const params = { ...TREE_DEFAULTS, ...input };
  const rand = mulberry32(params.seed);
  const R = () => rand();
  const H = params.height;

  const bark = new TubeBuilder();
  const clusters = []; // { p, d, s, depth }
  const anchors = []; // 장식을 걸 자리: 가지 바깥쪽
  const tips = []; // 전구 자리: 잔가지 끝
  const ENV_BINS = 48;
  const envelope = new Float32Array(ENV_BINS);

  const recordEnv = (p) => {
    const bin = clamp(Math.floor((p.y / (H + 0.3)) * ENV_BINS), 0, ENV_BINS - 1);
    envelope[bin] = Math.max(envelope[bin], Math.hypot(p.x, p.z));
  };

  // 줄기: 아래가 살짝 퍼지고 위로 갈수록 가늘어진다
  const trunkPts = [];
  const trunkR = [];
  const segs = 30;
  const swayA = R() * 6.28;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    trunkPts.push(new THREE.Vector3(Math.sin(t * 4 + swayA) * 0.025 * t, t * H, Math.cos(t * 3 + swayA) * 0.025 * t));
    // 땅에 닿는 부분은 뿌리 쪽으로 넓게 퍼진다
    trunkR.push(params.trunkRadius * Math.pow(1 - t, 0.85) + 0.006 + params.trunkRadius * 0.55 * Math.exp((-t * H) / 0.7));
  }
  bark.add(trunkPts, trunkR, 20);
  const trunkAt = (y) => {
    const f = clamp(y / H, 0, 1) * segs;
    const i = Math.min(Math.floor(f), segs - 1);
    const k = f - i;
    return { p: trunkPts[i].clone().lerp(trunkPts[i + 1], k), r: lerp(trunkR[i], trunkR[i + 1], k) };
  };

  // 뿌리 버팀: 밑동에서 땅으로 파고드는 굵은 뿌리
  const roots = 7;
  for (let i = 0; i < roots; i++) {
    const a = (i / roots) * Math.PI * 2 + (R() - 0.5) * 0.5;
    const reach = params.trunkRadius * (2.2 + R() * 1.2);
    const pts = [];
    const radii = [];
    for (let j = 0; j <= 8; j++) {
      const u = j / 8;
      const r = params.trunkRadius * 0.55 + reach * u;
      const y = lerp(0.9 + R() * 0.15, -0.12, Math.pow(u, 0.55));
      pts.push(new THREE.Vector3(Math.cos(a + u * 0.15) * r, y, Math.sin(a + u * 0.15) * r));
      radii.push(params.trunkRadius * lerp(0.42, 0.07, u));
    }
    bark.add(pts, radii, 8);
  }

  // 밑동의 옛 가지 자국: 짧게 잘린 가지 몇 개
  const clear = Math.min(params.clearTrunk, H * 0.25);
  const floorY = clear * 0.72;
  for (let i = 0; i < 6; i++) {
    const y = lerp(1.3, clear - 0.15, R());
    const a = R() * Math.PI * 2;
    const tr = trunkAt(y);
    const d = new THREE.Vector3(Math.cos(a), 0.15 + R() * 0.25, Math.sin(a)).normalize();
    const p0 = tr.p.clone().addScaledVector(new THREE.Vector3(d.x, 0, d.z).normalize(), tr.r * 0.7);
    const len = 0.18 + R() * 0.3;
    bark.add([p0, p0.clone().addScaledVector(d, len * 0.6), p0.clone().addScaledVector(d, len)], [0.07, 0.055, 0.045], 6);
  }

  const addNeedles = (p, d, depth, scale) => {
    const count = params.needles * 1.6;
    let n = Math.floor(count) + (R() < count % 1 ? 1 : 0);
    while (n-- > 0) {
      const dir = d.clone();
      dir.x += (R() - 0.5) * 0.7;
      dir.z += (R() - 0.5) * 0.7;
      dir.y += (R() - 0.35) * 0.4;
      dir.normalize();
      clusters.push({ p: p.clone(), d: dir, s: (0.3 + R() * 0.14) * scale * params.needleSize, depth });
    }
  };

  // 가지 하나를 자라게 한다. level 1 = 줄기에서 나온 가지, 2 = 잔가지
  const grow = (start, dir, len, r0, level, floor = floorY) => {
    const sections = level === 1 ? Math.max(4, Math.round(len / params.segLen)) : Math.max(3, Math.round(len / params.segLen));
    const seg = len / sections;
    const d = dir.clone();
    const p = start.clone();
    const pts = [p.clone()];
    const radii = [r0];
    const dirs = [d.clone()];
    for (let i = 1; i <= sections; i++) {
      const t = i / sections;
      const k = Math.min(seg / 0.2, 2.2);
      d.y += (-params.droop * 0.22 * (1 - t) + params.upturn * 0.2 * t * t) * k;
      d.x += (R() - 0.5) * 0.1 * k;
      d.z += (R() - 0.5) * 0.1 * k;
      // 밑동이 드러나도록 가지 끝이 일정 높이 아래로는 처지지 않는다
      if (p.y < floor) d.y = Math.max(d.y, 0.12);
      else if (p.y < floor + 0.6) d.y = Math.max(d.y, -0.05);
      d.normalize();
      p.addScaledVector(d, seg);
      pts.push(p.clone());
      radii.push(r0 * Math.pow(1 - t, 1.15) + 0.0025);
      dirs.push(d.clone());
      recordEnv(p);
    }
    bark.add(pts, radii, level === 1 ? 5 : 3);

    for (let i = 1; i <= sections; i++) {
      const t = i / sections;
      const mid = pts[i - 1].clone().lerp(pts[i], 0.5);
      if (level === 2 || t > 0.15) {
        addNeedles(mid, dirs[i], t, level === 1 ? 1 : 0.85);
        addNeedles(pts[i], dirs[i], t, level === 1 ? 1.05 : 0.8);
      }
      if (level === 1) {
        if (t > 0.5 && t < 0.97) anchors.push({ p: pts[i].clone(), d: dirs[i].clone(), t });
        // 좌우로 잔가지
        if (i < sections) {
          const side = new THREE.Vector3().crossVectors(dirs[i], UP);
          if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
          side.normalize();
          for (const sgn of [-1, 1]) {
            if (R() > params.twigs) continue;
            const a = 0.75 + R() * 0.35;
            const td = dirs[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a) * sgn);
            td.y += 0.08 + R() * 0.12;
            td.normalize();
            const tl = len * (1 - t) * 0.42 * (0.7 + R() * 0.6) + 0.14;
            grow(pts[i], td, tl, radii[i] * 0.45, 2, floor);
          }
        }
      } else if (i === sections) {
        tips.push({ p: pts[i].clone(), d: dirs[i].clone() });
      }
    }
  };

  const crownBase = clear;
  const crownTop = H * 0.94;
  for (let w = 0; w < params.whorls; w++) {
    const t = (w + 0.25 + R() * 0.5) / params.whorls;
    const y = lerp(crownBase, crownTop, t);
    const ht = y / H;
    const count = Math.max(3, Math.round(params.branchesPerWhorl * (1 - ht * 0.4) + (R() - 0.5) * 1.5));
    // 아래는 넉넉하고 위로 갈수록 좁아지는 볼록한 원뿔. 층마다 길이가 조금씩 달라 켜가 보인다
    const tier = 0.92 + 0.08 * Math.sin(t * Math.PI * 9);
    const len = params.spread * Math.pow(1 - t, 0.92) * tier * (0.88 + R() * 0.24) + 0.16;
    const rot0 = w * 2.39996;
    for (let k = 0; k < count; k++) {
      const az = rot0 + (k / count) * Math.PI * 2 + (R() - 0.5) * 0.45;
      const elev = lerp(0.06, 0.6, ht * ht) + (R() - 0.5) * 0.14;
      const dir = new THREE.Vector3(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az));
      const tr = trunkAt(y);
      const start = tr.p.clone().addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), tr.r * 0.6);
      // 가지마다 처짐 한계를 달리해 아래 끝선이 들쭉날쭉하게
      grow(start, dir, len, Math.max(0.012, tr.r * 0.32), 1, floorY + R() * 1.1);
    }
  }
  // 꼭대기 순: 위를 향한 잎 몇 묶음
  for (let i = 0; i < 10; i++) {
    const y = H * (0.93 + i * 0.007);
    const a = i * 2.4;
    addNeedles(trunkAt(y).p, new THREE.Vector3(Math.cos(a) * 0.5, 1, Math.sin(a) * 0.5).normalize(), 1, 0.7);
  }

  // 외곽선을 위아래로 부드럽게 (장식·갈런드 배치에 쓴다)
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 1; i < ENV_BINS - 1; i++) envelope[i] = Math.max(envelope[i], (envelope[i - 1] + envelope[i + 1]) * 0.5);
  }
  const envAt = (y) => {
    const f = clamp((y / (H + 0.3)) * ENV_BINS - 0.5, 0, ENV_BINS - 1);
    const i = Math.min(Math.floor(f), ENV_BINS - 2);
    return lerp(envelope[i], envelope[i + 1], f - i) + 0.18;
  };

  // 메시 만들기
  const group = new THREE.Group();
  group.name = 'tree';

  const barkMat = addSnow(
    new THREE.MeshStandardMaterial({ map: opts.barkMap ?? barkTexture(), color: opts.barkColor ?? 0xb8a48c, roughness: 0.95 }),
    sharedUniforms
  );
  const barkMesh = new THREE.Mesh(bark.build(), barkMat);
  barkMesh.name = 'bark';
  barkMesh.castShadow = true;
  barkMesh.receiveShadow = true;
  group.add(barkMesh);

  const needleMat = addSnow(
    new THREE.MeshStandardMaterial({
      map: needleTexture(),
      normalMap: needleNormalTexture(),
      normalScale: new THREE.Vector2(1.3, 1.3),
      alphaTest: 0.45,
      alphaToCoverage: true,
      side: THREE.DoubleSide,
      roughness: 0.62,
      color: opts.needleColor ?? 0xffffff,
    }),
    sharedUniforms,
    { glow: true }
  );
  // 순서를 섞어 두면 앞에서부터 일부만 그려도 나무 전체가 고르게 성겨진다 (반사용 축소 렌더)
  for (let i = clusters.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [clusters[i], clusters[j]] = [clusters[j], clusters[i]];
  }
  const needleMesh = new THREE.InstancedMesh(needleClusterGeometry(), needleMat, clusters.length);
  needleMesh.name = 'needles';
  needleMesh.userData.reflLod = 0.35;
  const m = new THREE.Matrix4();
  const X = new THREE.Vector3();
  const Y = new THREE.Vector3();
  const Z = new THREE.Vector3();
  const col = new THREE.Color();
  clusters.forEach((c, i) => {
    X.copy(c.d);
    Y.copy(UP).addScaledVector(X, -X.dot(UP));
    if (Y.lengthSq() < 1e-4) Y.set(0, 0, 1);
    Y.normalize();
    Z.crossVectors(X, Y);
    const roll = (R() - 0.5) * 0.9;
    const y2 = Y.clone().multiplyScalar(Math.cos(roll)).addScaledVector(Z, Math.sin(roll));
    Z.crossVectors(X, y2);
    m.makeBasis(X.clone().multiplyScalar(c.s), y2.multiplyScalar(c.s), Z.multiplyScalar(c.s));
    m.setPosition(c.p);
    needleMesh.setMatrixAt(i, m);
    // 안쪽 잎은 어둡게: 빛이 덜 드는 효과
    const radial = Math.hypot(c.p.x, c.p.z) / Math.max(0.3, envAt(c.p.y));
    const shade = lerp(0.42, 1.12, clamp(radial, 0, 1)) * (0.88 + R() * 0.24);
    col.setRGB(shade * (0.92 + R() * 0.12), shade, shade * (0.88 + R() * 0.1));
    needleMesh.setColorAt(i, col);
  });
  needleMesh.instanceMatrix.needsUpdate = true;
  needleMesh.castShadow = true;
  needleMesh.receiveShadow = true;
  needleMesh.computeBoundingSphere();
  group.add(needleMesh);
  // 그릴 때마다 개수를 정한다: 멀리서 보면 거리에 따라 줄이고, 그림자는 전부.
  // 거울 카메라(userData.isMirror)에서는 건드리지 않는다
  const fullCount = clusters.length;
  const _wp = new THREE.Vector3();
  const _tp = new THREE.Vector3();
  const _ws = new THREE.Vector3();
  const lodCount = (camera) => {
    if (opts.lod === false) return fullCount;
    group.matrixWorld.decompose(_tp, new THREE.Quaternion(), _ws);
    const s = _ws.y;
    _tp.y += H * 0.45 * s;
    const d = camera.getWorldPosition(_wp).distanceTo(_tp) / Math.max(1e-6, s);
    return Math.floor(fullCount * clamp(1.35 - d / (H * 3.2), 0.5, 1));
  };
  needleMesh.onBeforeRender = (_r, _s, camera) => {
    if (camera.userData.isMirror) return;
    needleMesh.count = lodCount(camera);
  };
  needleMesh.onBeforeShadow = () => (needleMesh.count = fullCount);

  // 깊이 선행 패스 (prepass.js): 잎은 수만 장이 겹쳐 같은 픽셀을 여러 번 칠한다
  let preMat = null;
  if (opts.prepass) {
    preMat = prepassMaterial(needleMat);
    equalDepthMaterial(needleMat, 'needle');
    const needlePre = attachPrepass(needleMesh, preMat);
    needlePre.onBeforeRender = (_r, _s, camera) => {
      if (camera.userData.isMirror) return;
      needlePre.count = lodCount(camera);
    };
  }

  return {
    group,
    params,
    height: H,
    crownBase,
    trunkRadius: params.trunkRadius,
    trunkAt,
    envAt,
    anchors,
    tips,
    barkMesh,
    needleMesh,
    stats: { needles: clusters.length, anchors: anchors.length, tips: tips.length },
    dispose() {
      barkMesh.geometry.dispose();
      needleMesh.geometry.dispose();
      barkMat.dispose();
      needleMat.dispose();
      needleMesh.dispose();
      preMat?.dispose();
    },
  };
}
