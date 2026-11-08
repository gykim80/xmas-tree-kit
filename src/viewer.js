import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChristmasTree } from './christmas-tree.js';
import { glowTexture } from './textures.js';
import { downloadGLB, exportGLB } from './export.js';

// 배경 분위기
const MOODS = {
  night: { top: '#0b1530', bottom: '#2a3a63', hemi: ['#9fb6e8', '#2a2233', 0.5], sun: ['#c8d6ff', 1.1], exposure: 1.0 },
  evening: { top: '#1d1840', bottom: '#d77a5c', hemi: ['#ffd2b0', '#3a2a40', 0.7], sun: ['#ffd0a0', 1.6], exposure: 1.0 },
  day: { top: '#7fb0e6', bottom: '#e8f0fa', hemi: ['#ffffff', '#8a8f99', 1.0], sun: ['#fff4e0', 2.4], exposure: 0.9 },
};

function gradientTexture(top, bottom) {
  if (typeof document === 'undefined') return new THREE.Color(top);
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// 내리는 눈 (화면을 향한 점)
function createSnowfall(radius, height, count = 1500) {
  const pos = new Float32Array(count * 3);
  const speed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (Math.random() * 2 - 1) * radius;
    pos[i * 3 + 1] = Math.random() * height;
    pos[i * 3 + 2] = (Math.random() * 2 - 1) * radius;
    speed[i] = 0.5 + Math.random() * 0.7;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ size: height * 0.012, map: glowTexture(), transparent: true, depthWrite: false, color: '#ffffff', opacity: 0.85 });
  const pts = new THREE.Points(g, mat);
  pts.name = 'snowfall';
  pts.frustumCulled = false;
  pts.userData.step = (dt, t) => {
    const fall = height * 0.08;
    for (let i = 0; i < count; i++) {
      let y = pos[i * 3 + 1] - dt * fall * speed[i];
      if (y < 0) y += height;
      pos[i * 3 + 1] = y;
      pos[i * 3] += Math.sin(t * 0.7 + i) * dt * 0.05 * radius * 0.05;
    }
    g.attributes.position.needsUpdate = true;
  };
  return pts;
}

// 트리 하나를 보여 주는 화면. 웹 컴포넌트와 에디터가 이것을 쓴다.
//   const v = createViewer(document.querySelector('#app'), { preset: 'cozy', background: 'night' });
export function createViewer(container, options = {}) {
  const {
    background = 'night', // 'night' | 'evening' | 'day' | 'transparent' | '#색'
    autoRotate = true,
    controls: useControls = true,
    ground = true,
    snowfall = true,
    shadows = true,
    pixelRatio = Math.min(2, typeof window !== 'undefined' ? window.devicePixelRatio : 1),
    renderer: externalRenderer = null,
    json = null, // 저장한 트리 JSON
    ...treeOptions
  } = options;

  const renderer =
    externalRenderer ??
    new THREE.WebGLRenderer({ antialias: true, alpha: background === 'transparent', preserveDrawingBuffer: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  if (!externalRenderer) {
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.touchAction = 'none';
    container.appendChild(renderer.domElement);
  }

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.35;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 500);
  const hemi = new THREE.HemisphereLight();
  const sun = new THREE.DirectionalLight();
  sun.castShadow = shadows;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);

  let tree = null;
  let floor = null;
  let snow = null;
  let bgTex = null;

  function setMood(name) {
    const mood = MOODS[name] ?? MOODS.night;
    bgTex?.dispose?.();
    bgTex = null;
    if (name === 'transparent') {
      scene.background = null;
      renderer.setClearColor(0x000000, 0);
    } else if (MOODS[name]) {
      bgTex = gradientTexture(mood.top, mood.bottom);
      scene.background = bgTex;
    } else {
      scene.background = new THREE.Color(name);
    }
    hemi.color.set(mood.hemi[0]);
    hemi.groundColor.set(mood.hemi[1]);
    hemi.intensity = mood.hemi[2];
    sun.color.set(mood.sun[0]);
    sun.intensity = mood.sun[1];
    renderer.toneMappingExposure = mood.exposure;
  }

  // 트리 크기에 맞춰 카메라·빛·바닥·눈을 다시 둔다
  function frame() {
    const H = tree.size;
    const fp = tree.footprint;
    const dist = H * 2.35;
    camera.position.set(dist * 0.55, H * 0.62, dist * 0.84);
    camera.near = H * 0.01;
    camera.far = H * 60;
    camera.updateProjectionMatrix();
    if (controls) {
      controls.target.set(0, H * 0.45, 0);
      controls.minDistance = H * 0.35;
      controls.maxDistance = H * 6;
      controls.update();
    } else camera.lookAt(0, H * 0.45, 0);
    sun.position.set(H * 1.2, H * 2.2, H * 0.9);
    const sc = sun.shadow.camera;
    const r = Math.max(fp.crownRadius, H * 0.4) * 1.6;
    sc.left = -r;
    sc.right = r;
    sc.top = r;
    sc.bottom = -r;
    sc.near = H * 0.1;
    sc.far = H * 6;
    sc.updateProjectionMatrix();
    if (floor) {
      scene.remove(floor);
      floor.geometry.dispose();
      floor.material.dispose();
      floor = null;
    }
    if (ground) {
      floor = new THREE.Mesh(
        new THREE.CircleGeometry(H * 6, 64),
        new THREE.MeshStandardMaterial({ color: typeof ground === 'string' ? ground : '#dfe7f2', roughness: 0.95 })
      );
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      floor.name = 'ground';
      scene.add(floor);
    }
    if (snow) {
      scene.remove(snow);
      snow.geometry.dispose();
      snow.material.dispose();
      snow = null;
    }
    if (snowfall) {
      snow = createSnowfall(H * 2.2, H * 2);
      scene.add(snow);
    }
  }

  const controls = useControls ? new OrbitControls(camera, renderer.domElement) : null;
  if (controls) {
    controls.enableDamping = true;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.6;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI * 0.53;
    // 만지면 자동 회전을 멈추고 6초 뒤 다시 돈다
    let idle = 0;
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
      clearTimeout(idle);
    });
    controls.addEventListener('end', () => {
      clearTimeout(idle);
      if (api.autoRotate) idle = setTimeout(() => (controls.autoRotate = true), 6000);
    });
  }

  function setTree(next) {
    if (tree) {
      scene.remove(tree);
      tree.dispose();
    }
    tree = next instanceof ChristmasTree ? next : next?.format ? ChristmasTree.fromJSON(next) : new ChristmasTree(next ?? {});
    scene.add(tree);
    frame();
    api.tree = tree;
    return tree;
  }

  // 크기
  let w = 0;
  let h = 0;
  function resize() {
    const r = container.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width));
    const nh = Math.max(1, Math.round(r.height));
    if (nw === w && nh === h) return;
    w = nw;
    h = nh;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  ro?.observe(container);

  // 화면 밖이면 그리지 않는다
  let visible = true;
  const io =
    typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((es) => {
          visible = es[0]?.isIntersecting ?? true;
        })
      : null;
  io?.observe(container);

  const clock = new THREE.Timer();
  let raf = 0;
  let running = true;
  const hooks = new Set();
  function loop() {
    raf = requestAnimationFrame(loop);
    clock.update();
    const dt = Math.min(0.05, clock.getDelta());
    if (!visible || !running) return;
    resize();
    controls?.update(dt);
    snow?.userData.step(dt, clock.getElapsed());
    for (const fn of hooks) fn(dt, clock.getElapsed());
    renderer.render(scene, camera);
  }

  const api = {
    scene,
    camera,
    renderer,
    controls,
    tree: null,
    autoRotate,
    setTree,
    setBackground: setMood,
    frame,
    // 매 프레임 부를 함수 등록 (지우는 함수를 돌려준다)
    onFrame(fn) {
      hooks.add(fn);
      return () => hooks.delete(fn);
    },
    // 화면 좌표(px) → NDC
    ndc(clientX, clientY) {
      const r = renderer.domElement.getBoundingClientRect();
      return new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    },
    // 지금 화면을 PNG 로
    toBlob(type = 'image/png') {
      renderer.render(scene, camera);
      return new Promise((res) => renderer.domElement.toBlob(res, type));
    },
    exportGLB: (opts) => exportGLB(tree, opts),
    downloadGLB: (name, opts) => downloadGLB(tree, name, opts),
    pause() {
      running = false;
    },
    resume() {
      running = true;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      controls?.dispose();
      tree?.dispose();
      floor?.geometry.dispose();
      snow?.geometry.dispose();
      envRT.dispose();
      pmrem.dispose();
      if (!externalRenderer) {
        renderer.dispose();
        renderer.domElement.remove();
      }
    },
  };

  setMood(background);
  resize();
  setTree(json ?? treeOptions);
  loop();
  return api;
}
