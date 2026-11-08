import * as THREE from 'three';

// 깊이 선행 패스: 알파로 오려낸(alphaTest) 판이 겹겹이 쌓인 메시용.
// 텍스처 알파만 보는 싼 재질로 깊이를 먼저 쓰고, 본 재질은 깊이가 같은 픽셀만 조명 계산을 한다.
// 본 패스에 discard 가 없어 타일 GPU(애플 등)의 숨은 면 제거도 산다. 화면 결과는 같다.
// 두 패스의 깊이가 비트 단위로 같도록 gl_Position 을 invariant 로 묶는다
const invariant = (shader) => (shader.vertexShader = 'invariant gl_Position;\n' + shader.vertexShader);

export function prepassMaterial(source) {
  const m = new THREE.MeshBasicMaterial({ map: source.map, alphaTest: source.alphaTest, alphaToCoverage: source.alphaToCoverage, side: source.side, colorWrite: false });
  m.onBeforeCompile = invariant;
  m.customProgramCacheKey = () => `prepass-${source.alphaToCoverage ? 'a2c' : ''}`;
  return m;
}

// 본 재질을 "깊이가 같은 픽셀만" 그리게 바꾼다. alphaTest 값은 남겨 두고(그림자는 three 가 이 값으로
// 잎·나무 모양대로 오려낸다) 화면용 셰이더에서 discard 줄만 뺀다
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

// 인스턴스 메시 하나에 선행 패스 메시를 붙인다 (같은 행렬·같은 개수)
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
  mesh.userData.noAO = true; // 오려내지 않는 본 패스는 AO 법선 버퍼에서 뺀다 (선행 패스는 alphaTest 로 빠진다)
  mesh.parent?.add(pre);
  return pre;
}
