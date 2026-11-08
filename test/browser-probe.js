// scripts/check.mjs check helpers loaded in the browser by scripts/check.mjs (the dev server resolves module paths)
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
