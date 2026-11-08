import * as THREE from 'three';

// Depth prepass: for meshes made of many stacked alpha-tested cards.
// A cheap alpha-only material writes depth first; the main material only shades pixels with equal depth.
// With no discard in the main pass, hidden surface removal on tile GPUs (Apple etc.) still works. Output is identical.
// gl_Position is marked invariant so both passes produce bit-identical depth
const invariant = (shader) => (shader.vertexShader = 'invariant gl_Position;\n' + shader.vertexShader);

export function prepassMaterial(source) {
  const m = new THREE.MeshBasicMaterial({ map: source.map, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, side: source.side, colorWrite: false });
  m.onBeforeCompile = invariant;
  m.customProgramCacheKey = () => `prepass-${source.alphaToCoverage ? 'a2c' : ''}`;
  return m;
}

// Make the main material draw only "equal depth" pixels. Keep alphaTest (three uses it to cut
// shadows to the needle and branch shapes) and strip only the discard line from the color shader
export function equalDepthMaterial(material, cacheKey) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    prev?.call(material, shader, renderer);
    invariant(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', '');
  };
  const key = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => `${key ? key() : ''}-eq-${cacheKey}`;
  material.alphaToCoverage = false;
  material.depthFunc = THREE.EqualDepth;
  material.depthWrite = false;
  return material;
}

// Attach a prepass mesh to an instanced mesh (same matrices, same count)
export function attachPrepass(mesh, preMat) {
  const pre = new THREE.InstancedMesh(mesh.geometry, preMat, mesh.count);
  pre.instanceMatrix = mesh.instanceMatrix;
  pre.boundingSphere = mesh.boundingSphere;
  pre.renderOrder = -1;
  pre.frustumCulled = mesh.frustumCulled;
  pre.userData.noRefl = mesh.userData.noRefl;
  pre.userData.reflLod = mesh.userData.reflLod;
  const sync = () => (pre.count = mesh.count);
  pre.onBeforeRender = sync;
  mesh.userData.noAO = true; // exclude the non-cutout main pass from the AO normal buffer (the prepass is excluded via alphaTest)
  mesh.parent?.add(pre);
  return pre;
}
