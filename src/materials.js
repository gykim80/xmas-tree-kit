import * as THREE from 'three';

// 위를 향한 면에 눈을 덮는 셰이더 패치 (나무껍질·바늘잎 공용). uniforms 는 트리마다 하나 (createUniforms)
export function addSnow(material, uniforms, { glow = false } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = uniforms.uSnow;
    shader.uniforms.uGlow = uniforms.uGlow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowN;\nvarying vec3 vSnowP;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec3 snObj = objectNormal;
        vec4 snPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          snObj = mat3(instanceMatrix) * snObj;
          snPos = instanceMatrix * snPos;
        #endif
        vSnowN = normalize(mat3(modelMatrix) * snObj);
        vSnowP = (modelMatrix * snPos).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uSnow;
        uniform float uGlow;
        varying vec3 vSnowN;
        varying vec3 vSnowP;
        float snowHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec3 snN = normalize(vSnowN) * (gl_FrontFacing ? 1.0 : -1.0);
          float snNoise = snowHash(floor(vSnowP * 22.0));
          float snowAmt = smoothstep(0.2, 0.7, snN.y + (snNoise - 0.5) * 0.45 - (1.0 - uSnow) * 1.25);
          snowAmt *= step(0.001, uSnow);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 1.0), snowAmt);
        }`
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        ${glow ? 'totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.55, 0.22) * 0.07 * uGlow;' : ''}`
      );
  };
  material.customProgramCacheKey = () => `snow${glow ? '-glow' : ''}`;
  return material;
}

// 깜박이는 전구 재질: 인스턴스마다 위상이 달라 따로 반짝인다
export function createBulbMaterial(uniforms) {
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uTwinkle = uniforms.uTwinkle;
    shader.uniforms.uGlow = uniforms.uGlow;
    shader.uniforms.uPx = uniforms.uPx;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aPhase;
        uniform float uTime;
        uniform float uTwinkle;
        uniform float uPx;
        varying float vTw;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float twWave = 0.5 + 0.5 * sin(uTime * uTwinkle * (0.6 + fract(aPhase * 7.13)) + aPhase * 6.2831);
        vTw = mix(1.0, 0.25 + 0.75 * twWave * twWave, step(0.001, uTwinkle));
        // 멀리 있는 전구가 1픽셀보다 작아지면 깜박이며 번진다: 최소 크기를 지키고 밝기는 면적만큼 줄인다
        {
          vec4 bulbC = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float bulbR = max(length(position) * length(modelMatrix[0].xyz), 1e-4); // 트리를 줄여 써도 화면 크기로 잰다
          float grow = max(1.0, (-bulbC.z * uPx * 1.6) / bulbR);
          transformed *= grow;
          vTw /= grow * grow;
        }`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow;\nvarying float vTw;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= vTw * uGlow;');
  };
  mat.customProgramCacheKey = () => 'bulb';
  return mat;
}

// 인스턴스마다 깜박임 위상을 넣는다
export function setBulbPhases(mesh, rand) {
  const phases = new Float32Array(mesh.count);
  for (let i = 0; i < phases.length; i++) phases[i] = rand();
  mesh.geometry.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
}

// 트리 하나가 쓰는 셰이더 값. 여러 트리가 같은 값을 쓰려면 같은 객체를 넘긴다
export function createUniforms({ snow = 0.5, glow = 3, twinkle = 2.2 } = {}) {
  return {
    uTime: { value: 0 },
    uSnow: { value: snow },
    uTwinkle: { value: twinkle },
    uGlow: { value: glow },
    uPx: { value: 0.001 }, // 화면 한 픽셀이 거리 1 에서 덮는 길이 (전구 최소 크기)
  };
}
