// scripts/check.mjs 가 브라우저 안에서 불러 쓰는 점검 도우미 (개발 서버가 모듈 경로를 풀어 준다)
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ChristmasTree, exportGLB } from '../src/index.js';

export async function probeGLB(tree) {
  const light = ChristmasTree.fromJSON(tree.toJSON(), { quality: 'low' });
  const baked = await exportGLB(light, { bake: true });
  const inst = await exportGLB(light, { bake: false });
  const gltf = await new GLTFLoader().parseAsync(baked, '');
  let meshes = 0;
  gltf.scene.traverse((o) => o.isMesh && meshes++);
  const box = new THREE.Box3().setFromObject(gltf.scene);
  light.dispose();
  return { baked: baked.byteLength, inst: inst.byteLength, meshes, height: box.max.y - box.min.y };
}
