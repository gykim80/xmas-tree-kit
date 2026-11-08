import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
// src/core/rng.js
function mulberry32(seed) {
	let a = seed >>> 0;
	return function() {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
var lerp = (a, b, t) => a + (b - a) * t;
var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
// src/textures.js
var HAS_DOM = typeof document !== "undefined";
function makeCanvas(w, h) {
	const c = document.createElement("canvas");
	c.width = w;
	c.height = h;
	return [c, c.getContext("2d")];
}
function toTexture(canvas, { srgb = true, repeat = false } = {}) {
	const tex = new THREE.CanvasTexture(canvas);
	if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
	if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
	tex.anisotropy = 8;
	return tex;
}
var cache = /* @__PURE__ */ new Map();
function cached(key, fn) {
	if (!HAS_DOM) return null;
	if (!cache.has(key)) cache.set(key, fn());
	return cache.get(key);
}
function needleTexture() {
	return cached("needle", () => {
		const [c, ctx] = makeCanvas(512, 256);
		const rand = mulberry32(42);
		const mid = 128;
		ctx.lineCap = "round";
		ctx.strokeStyle = "#3b2c1a";
		ctx.lineWidth = 6;
		ctx.beginPath();
		ctx.moveTo(4, mid);
		ctx.lineTo(496, mid);
		ctx.stroke();
		for (let i = 0; i < 340; i++) {
			const x = 8 + rand() * 470;
			const t = x / 512;
			const side = i % 2 ? 1 : -1;
			const len = (78 + rand() * 38) * (1 - t * .5);
			const ang = .6 + rand() * .55;
			const ex = x + Math.cos(ang) * len;
			const ey = mid + side * Math.sin(ang) * len;
			const g = ctx.createLinearGradient(x, mid, ex, ey);
			const light = rand();
			g.addColorStop(0, "#0f2d17");
			g.addColorStop(.55, light > .5 ? "#245a2b" : "#1d4d27");
			g.addColorStop(1, light > .7 ? "#4f8b46" : "#336f37");
			ctx.strokeStyle = g;
			ctx.lineWidth = 3.2 + rand() * 1.6;
			ctx.beginPath();
			ctx.moveTo(x, mid + side * 2);
			ctx.quadraticCurveTo(x + Math.cos(ang) * len * .5, mid + side * Math.sin(ang) * len * .42, ex, ey);
			ctx.stroke();
		}
		const tex = toTexture(c);
		tex.generateMipmaps = true;
		return tex;
	});
}
function barkTexture() {
	return cached("bark", () => {
		const [c, ctx] = makeCanvas(256, 512);
		const rand = mulberry32(7);
		ctx.fillStyle = "#3a2717";
		ctx.fillRect(0, 0, 256, 512);
		for (let i = 0; i < 420; i++) {
			const x = rand() * 256;
			const y = rand() * 512;
			const l = 30 + rand() * 120;
			const v = 30 + rand() * 50;
			ctx.strokeStyle = `rgba(${v + 30},${v + 10},${v - 10},${.25 + rand() * .5})`;
			ctx.lineWidth = 1 + rand() * 4;
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.bezierCurveTo(x + rand() * 8 - 4, y + l * .3, x + rand() * 8 - 4, y + l * .6, x + rand() * 6 - 3, y + l);
			ctx.stroke();
		}
		return toTexture(c, { repeat: true });
	});
}
function glowTexture() {
	return cached("glow", () => {
		const [c, ctx] = makeCanvas(128, 128);
		const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
		g.addColorStop(0, "rgba(255,255,255,1)");
		g.addColorStop(.25, "rgba(255,240,200,0.55)");
		g.addColorStop(.6, "rgba(255,220,150,0.12)");
		g.addColorStop(1, "rgba(255,220,150,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, 128, 128);
		return toTexture(c);
	});
}
function wrapTexture(base, accent, style) {
	return cached(`wrap-${base}-${accent}-${style}`, () => {
		const [c, ctx] = makeCanvas(128, 128);
		ctx.fillStyle = base;
		ctx.fillRect(0, 0, 128, 128);
		ctx.fillStyle = accent;
		if (style === 0) for (let i = -128; i < 256; i += 24) {
			ctx.beginPath();
			ctx.moveTo(i, 0);
			ctx.lineTo(i + 10, 0);
			ctx.lineTo(i + 138, 128);
			ctx.lineTo(i + 128, 128);
			ctx.fill();
		}
		else if (style === 1) for (let y = 8; y < 128; y += 22) for (let x = y / 22 % 2 ? 8 : 19; x < 128; x += 22) {
			ctx.beginPath();
			ctx.arc(x, y, 4, 0, Math.PI * 2);
			ctx.fill();
		}
		else {
			for (let y = 0; y < 128; y += 32) ctx.fillRect(0, y, 128, 6);
			for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 6, 128);
		}
		return toTexture(c, { repeat: true });
	});
}
function needleNormalTexture() {
	return cached("needleNormal", () => {
		const src = needleTexture().image;
		const w = src.width;
		const h = src.height;
		const a = src.getContext("2d").getImageData(0, 0, w, h).data;
		const [c, ctx] = makeCanvas(w, h);
		const out = ctx.createImageData(w, h);
		const H = (x, y) => a[(Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4 + 3] / 255;
		for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
			const dx = (H(x + 1, y) - H(x - 1, y)) * 2.5;
			const dy = (H(x, y + 1) - H(x, y - 1)) * 2.5;
			const l = Math.hypot(dx, dy, 1);
			const i = (y * w + x) * 4;
			out.data[i] = (-dx / l * .5 + .5) * 255;
			out.data[i + 1] = (dy / l * .5 + .5) * 255;
			out.data[i + 2] = (1 / l * .5 + .5) * 255;
			out.data[i + 3] = 255;
		}
		ctx.putImageData(out, 0, 0);
		return toTexture(c, { srgb: false });
	});
}
function stoneTexture() {
	return cached("stone", () => {
		const [c, ctx] = makeCanvas(256, 128);
		const rand = mulberry32(5);
		ctx.fillStyle = "#5d5953";
		ctx.fillRect(0, 0, 256, 128);
		for (let r = 0; r < 4; r++) {
			const off = r % 2 * 24;
			for (let k = -1; k < 6; k++) {
				const v = 120 + rand() * 50;
				ctx.fillStyle = `rgb(${v},${v - 4},${v - 10})`;
				ctx.beginPath();
				ctx.roundRect(k * 48 + off + 2, r * 32 + 2, 44, 28, 6);
				ctx.fill();
			}
		}
		return toTexture(c, { repeat: true });
	});
}
// src/materials.js
function addSnow(material, uniforms, { glow = false } = {}) {
	material.onBeforeCompile = (shader) => {
		shader.uniforms.uSnow = uniforms.uSnow;
		shader.uniforms.uGlow = uniforms.uGlow;
		shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vSnowN;\nvarying vec3 vSnowP;").replace("#include <worldpos_vertex>", `#include <worldpos_vertex>
        vec3 snObj = objectNormal;
        vec4 snPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          snObj = mat3(instanceMatrix) * snObj;
          snPos = instanceMatrix * snPos;
        #endif
        vSnowN = normalize(mat3(modelMatrix) * snObj);
        vSnowP = (modelMatrix * snPos).xyz;`);
		shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
        uniform float uSnow;
        uniform float uGlow;
        varying vec3 vSnowN;
        varying vec3 vSnowP;
        float snowHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }`).replace("#include <color_fragment>", `#include <color_fragment>
        {
          vec3 snN = normalize(vSnowN) * (gl_FrontFacing ? 1.0 : -1.0);
          float snNoise = snowHash(floor(vSnowP * 22.0));
          float snowAmt = smoothstep(0.2, 0.7, snN.y + (snNoise - 0.5) * 0.45 - (1.0 - uSnow) * 1.25);
          snowAmt *= step(0.001, uSnow);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.94, 1.0), snowAmt);
        }`).replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        ${glow ? "totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.55, 0.22) * 0.07 * uGlow;" : ""}`);
	};
	material.customProgramCacheKey = () => `snow${glow ? "-glow" : ""}`;
	return material;
}
function createBulbMaterial(uniforms) {
	const mat = new THREE.MeshBasicMaterial({
		color: 16777215,
		toneMapped: false
	});
	mat.onBeforeCompile = (shader) => {
		shader.uniforms.uTime = uniforms.uTime;
		shader.uniforms.uTwinkle = uniforms.uTwinkle;
		shader.uniforms.uGlow = uniforms.uGlow;
		shader.uniforms.uPx = uniforms.uPx;
		shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
        attribute float aPhase;
        uniform float uTime;
        uniform float uTwinkle;
        uniform float uPx;
        varying float vTw;`).replace("#include <begin_vertex>", `#include <begin_vertex>
        float twWave = 0.5 + 0.5 * sin(uTime * uTwinkle * (0.6 + fract(aPhase * 7.13)) + aPhase * 6.2831);
        vTw = mix(1.0, 0.25 + 0.75 * twWave * twWave, step(0.001, uTwinkle));
        // 멀리 있는 전구가 1픽셀보다 작아지면 깜박이며 번진다: 최소 크기를 지키고 밝기는 면적만큼 줄인다
        {
          vec4 bulbC = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float bulbR = max(length(position) * length(modelMatrix[0].xyz), 1e-4); // 트리를 줄여 써도 화면 크기로 잰다
          float grow = max(1.0, (-bulbC.z * uPx * 1.6) / bulbR);
          transformed *= grow;
          vTw /= grow * grow;
        }`);
		shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uGlow;\nvarying float vTw;").replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= vTw * uGlow;");
	};
	mat.customProgramCacheKey = () => "bulb";
	return mat;
}
function setBulbPhases(mesh, rand) {
	const phases = new Float32Array(mesh.count);
	for (let i = 0; i < phases.length; i++) phases[i] = rand();
	mesh.geometry.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
}
function createUniforms({ snow = .5, glow = 3, twinkle = 2.2 } = {}) {
	return {
		uTime: { value: 0 },
		uSnow: { value: snow },
		uTwinkle: { value: twinkle },
		uGlow: { value: glow },
		uPx: { value: .001 }
	};
}
// src/prepass.js
var invariant = (shader) => shader.vertexShader = "invariant gl_Position;\n" + shader.vertexShader;
function prepassMaterial(source) {
	const m = new THREE.MeshBasicMaterial({
		map: source.map,
		alphaTest: source.alphaTest,
		alphaToCoverage: source.alphaToCoverage,
		side: source.side,
		colorWrite: false
	});
	m.onBeforeCompile = invariant;
	m.customProgramCacheKey = () => `prepass-${source.alphaToCoverage ? "a2c" : ""}`;
	return m;
}
function equalDepthMaterial(material, cacheKey) {
	const prev = material.onBeforeCompile;
	material.onBeforeCompile = (shader, renderer) => {
		prev?.call(material, shader, renderer);
		invariant(shader);
		shader.fragmentShader = shader.fragmentShader.replace("#include <alphatest_fragment>", "");
	};
	const key = material.customProgramCacheKey?.bind(material);
	material.customProgramCacheKey = () => `${key ? key() : ""}-eq-${cacheKey}`;
	material.alphaToCoverage = false;
	material.depthFunc = THREE.EqualDepth;
	material.depthWrite = false;
	return material;
}
function attachPrepass(mesh, preMat) {
	const pre = new THREE.InstancedMesh(mesh.geometry, preMat, mesh.count);
	pre.instanceMatrix = mesh.instanceMatrix;
	pre.boundingSphere = mesh.boundingSphere;
	pre.renderOrder = -1;
	pre.frustumCulled = mesh.frustumCulled;
	pre.userData.noRefl = mesh.userData.noRefl;
	pre.userData.reflLod = mesh.userData.reflLod;
	const sync = () => pre.count = mesh.count;
	pre.onBeforeRender = sync;
	mesh.userData.noAO = true;
	mesh.parent?.add(pre);
	return pre;
}
// src/tree/tree.js
var TREE_DEFAULTS = {
	seed: 1225,
	height: 20,
	trunkRadius: .62,
	clearTrunk: 3.2,
	whorls: 56,
	branchesPerWhorl: 10,
	spread: 7,
	droop: .36,
	upturn: .55,
	twigs: 1,
	needles: 1,
	needleSize: 1.55,
	segLen: .34
};
var UP = new THREE.Vector3(0, 1, 0);
var X_AXIS = new THREE.Vector3(1, 0, 0);
var TubeBuilder = class {
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
		const ref = Math.abs(tangent.y) < .9 ? UP : X_AXIS;
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
				const a = j / radial * Math.PI * 2;
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
		for (let i = 0; i < n - 1; i++) for (let j = 0; j < radial; j++) {
			const a = base + i * ring + j;
			const b = a + ring;
			this.idx.push(a, a + 1, b, a + 1, b + 1, b);
		}
	}
	build() {
		const g = new THREE.BufferGeometry();
		g.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
		g.setAttribute("normal", new THREE.Float32BufferAttribute(this.nor, 3));
		g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uv, 2));
		g.setIndex(this.idx);
		g.computeBoundingSphere();
		return g;
	}
};
function needleClusterGeometry() {
	const a = new THREE.PlaneGeometry(1, .5);
	a.rotateX(-Math.PI / 2);
	a.translate(.5, 0, 0);
	const b = new THREE.PlaneGeometry(1, .32);
	b.translate(.5, 0, 0);
	return mergeGeometries([a, b]);
}
function buildTree(input = {}, sharedUniforms, opts = {}) {
	const params = {
		...TREE_DEFAULTS,
		...input
	};
	const rand = mulberry32(params.seed);
	const R = () => rand();
	const H = params.height;
	const bark = new TubeBuilder();
	const clusters = [];
	const anchors = [];
	const tips = [];
	const ENV_BINS = 48;
	const envelope = new Float32Array(ENV_BINS);
	const recordEnv = (p) => {
		const bin = clamp(Math.floor(p.y / (H + .3) * ENV_BINS), 0, 47);
		envelope[bin] = Math.max(envelope[bin], Math.hypot(p.x, p.z));
	};
	const trunkPts = [];
	const trunkR = [];
	const segs = 30;
	const swayA = R() * 6.28;
	for (let i = 0; i <= segs; i++) {
		const t = i / segs;
		trunkPts.push(new THREE.Vector3(Math.sin(t * 4 + swayA) * .025 * t, t * H, Math.cos(t * 3 + swayA) * .025 * t));
		trunkR.push(params.trunkRadius * Math.pow(1 - t, .85) + .006 + params.trunkRadius * .55 * Math.exp(-t * H / .7));
	}
	bark.add(trunkPts, trunkR, 20);
	const trunkAt = (y) => {
		const f = clamp(y / H, 0, 1) * segs;
		const i = Math.min(Math.floor(f), 29);
		const k = f - i;
		return {
			p: trunkPts[i].clone().lerp(trunkPts[i + 1], k),
			r: lerp(trunkR[i], trunkR[i + 1], k)
		};
	};
	const roots = 7;
	for (let i = 0; i < roots; i++) {
		const a = i / roots * Math.PI * 2 + (R() - .5) * .5;
		const reach = params.trunkRadius * (2.2 + R() * 1.2);
		const pts = [];
		const radii = [];
		for (let j = 0; j <= 8; j++) {
			const u = j / 8;
			const r = params.trunkRadius * .55 + reach * u;
			const y = lerp(.9 + R() * .15, -.12, Math.pow(u, .55));
			pts.push(new THREE.Vector3(Math.cos(a + u * .15) * r, y, Math.sin(a + u * .15) * r));
			radii.push(params.trunkRadius * lerp(.42, .07, u));
		}
		bark.add(pts, radii, 8);
	}
	const clear = Math.min(params.clearTrunk, H * .25);
	const floorY = clear * .72;
	for (let i = 0; i < 6; i++) {
		const y = lerp(1.3, clear - .15, R());
		const a = R() * Math.PI * 2;
		const tr = trunkAt(y);
		const d = new THREE.Vector3(Math.cos(a), .15 + R() * .25, Math.sin(a)).normalize();
		const p0 = tr.p.clone().addScaledVector(new THREE.Vector3(d.x, 0, d.z).normalize(), tr.r * .7);
		const len = .18 + R() * .3;
		bark.add([
			p0,
			p0.clone().addScaledVector(d, len * .6),
			p0.clone().addScaledVector(d, len)
		], [
			.07,
			.055,
			.045
		], 6);
	}
	const addNeedles = (p, d, depth, scale) => {
		const count = params.needles * 1.6;
		let n = Math.floor(count) + (R() < count % 1 ? 1 : 0);
		while (n-- > 0) {
			const dir = d.clone();
			dir.x += (R() - .5) * .7;
			dir.z += (R() - .5) * .7;
			dir.y += (R() - .35) * .4;
			dir.normalize();
			clusters.push({
				p: p.clone(),
				d: dir,
				s: (.3 + R() * .14) * scale * params.needleSize,
				depth
			});
		}
	};
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
			const k = Math.min(seg / .2, 2.2);
			d.y += (-params.droop * .22 * (1 - t) + params.upturn * .2 * t * t) * k;
			d.x += (R() - .5) * .1 * k;
			d.z += (R() - .5) * .1 * k;
			if (p.y < floor) d.y = Math.max(d.y, .12);
			else if (p.y < floor + .6) d.y = Math.max(d.y, -.05);
			d.normalize();
			p.addScaledVector(d, seg);
			pts.push(p.clone());
			radii.push(r0 * Math.pow(1 - t, 1.15) + .0025);
			dirs.push(d.clone());
			recordEnv(p);
		}
		bark.add(pts, radii, level === 1 ? 5 : 3);
		for (let i = 1; i <= sections; i++) {
			const t = i / sections;
			const mid = pts[i - 1].clone().lerp(pts[i], .5);
			if (level === 2 || t > .15) {
				addNeedles(mid, dirs[i], t, level === 1 ? 1 : .85);
				addNeedles(pts[i], dirs[i], t, level === 1 ? 1.05 : .8);
			}
			if (level === 1) {
				if (t > .5 && t < .97) anchors.push({
					p: pts[i].clone(),
					d: dirs[i].clone(),
					t
				});
				if (i < sections) {
					const side = new THREE.Vector3().crossVectors(dirs[i], UP);
					if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
					side.normalize();
					for (const sgn of [-1, 1]) {
						if (R() > params.twigs) continue;
						const a = .75 + R() * .35;
						const td = dirs[i].clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a) * sgn);
						td.y += .08 + R() * .12;
						td.normalize();
						const tl = len * (1 - t) * .42 * (.7 + R() * .6) + .14;
						grow(pts[i], td, tl, radii[i] * .45, 2, floor);
					}
				}
			} else if (i === sections) tips.push({
				p: pts[i].clone(),
				d: dirs[i].clone()
			});
		}
	};
	const crownBase = clear;
	const crownTop = H * .94;
	for (let w = 0; w < params.whorls; w++) {
		const t = (w + .25 + R() * .5) / params.whorls;
		const y = lerp(crownBase, crownTop, t);
		const ht = y / H;
		const count = Math.max(3, Math.round(params.branchesPerWhorl * (1 - ht * .4) + (R() - .5) * 1.5));
		const tier = .92 + .08 * Math.sin(t * Math.PI * 9);
		const len = params.spread * Math.pow(1 - t, .92) * tier * (.88 + R() * .24) + .16;
		const rot0 = w * 2.39996;
		for (let k = 0; k < count; k++) {
			const az = rot0 + k / count * Math.PI * 2 + (R() - .5) * .45;
			const elev = lerp(.06, .6, ht * ht) + (R() - .5) * .14;
			const dir = new THREE.Vector3(Math.cos(elev) * Math.cos(az), Math.sin(elev), Math.cos(elev) * Math.sin(az));
			const tr = trunkAt(y);
			grow(tr.p.clone().addScaledVector(new THREE.Vector3(dir.x, 0, dir.z).normalize(), tr.r * .6), dir, len, Math.max(.012, tr.r * .32), 1, floorY + R() * 1.1);
		}
	}
	for (let i = 0; i < 10; i++) {
		const y = H * (.93 + i * .007);
		const a = i * 2.4;
		addNeedles(trunkAt(y).p, new THREE.Vector3(Math.cos(a) * .5, 1, Math.sin(a) * .5).normalize(), 1, .7);
	}
	for (let pass = 0; pass < 2; pass++) for (let i = 1; i < 47; i++) envelope[i] = Math.max(envelope[i], (envelope[i - 1] + envelope[i + 1]) * .5);
	const envAt = (y) => {
		const f = clamp(y / (H + .3) * ENV_BINS - .5, 0, 47);
		const i = Math.min(Math.floor(f), 46);
		return lerp(envelope[i], envelope[i + 1], f - i) + .18;
	};
	const group = new THREE.Group();
	group.name = "tree";
	const barkMat = addSnow(new THREE.MeshStandardMaterial({
		map: opts.barkMap ?? barkTexture(),
		color: opts.barkColor ?? 12100748,
		roughness: .95
	}), sharedUniforms);
	const barkMesh = new THREE.Mesh(bark.build(), barkMat);
	barkMesh.name = "bark";
	barkMesh.castShadow = true;
	barkMesh.receiveShadow = true;
	group.add(barkMesh);
	const needleMat = addSnow(new THREE.MeshStandardMaterial({
		map: needleTexture(),
		normalMap: needleNormalTexture(),
		normalScale: new THREE.Vector2(1.3, 1.3),
		alphaTest: .45,
		alphaToCoverage: true,
		side: THREE.DoubleSide,
		roughness: .62,
		color: opts.needleColor ?? 16777215
	}), sharedUniforms, { glow: true });
	for (let i = clusters.length - 1; i > 0; i--) {
		const j = Math.floor(R() * (i + 1));
		[clusters[i], clusters[j]] = [clusters[j], clusters[i]];
	}
	const needleMesh = new THREE.InstancedMesh(needleClusterGeometry(), needleMat, clusters.length);
	needleMesh.name = "needles";
	needleMesh.userData.reflLod = .35;
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
		const roll = (R() - .5) * .9;
		const y2 = Y.clone().multiplyScalar(Math.cos(roll)).addScaledVector(Z, Math.sin(roll));
		Z.crossVectors(X, y2);
		m.makeBasis(X.clone().multiplyScalar(c.s), y2.multiplyScalar(c.s), Z.multiplyScalar(c.s));
		m.setPosition(c.p);
		needleMesh.setMatrixAt(i, m);
		const shade = lerp(.42, 1.12, clamp(Math.hypot(c.p.x, c.p.z) / Math.max(.3, envAt(c.p.y)), 0, 1)) * (.88 + R() * .24);
		col.setRGB(shade * (.92 + R() * .12), shade, shade * (.88 + R() * .1));
		needleMesh.setColorAt(i, col);
	});
	needleMesh.instanceMatrix.needsUpdate = true;
	needleMesh.castShadow = true;
	needleMesh.receiveShadow = true;
	needleMesh.computeBoundingSphere();
	group.add(needleMesh);
	const fullCount = clusters.length;
	const _wp = new THREE.Vector3();
	const _tp = new THREE.Vector3();
	const _ws = new THREE.Vector3();
	const lodCount = (camera) => {
		if (opts.lod === false) return fullCount;
		group.matrixWorld.decompose(_tp, new THREE.Quaternion(), _ws);
		const s = _ws.y;
		_tp.y += H * .45 * s;
		const d = camera.getWorldPosition(_wp).distanceTo(_tp) / Math.max(1e-6, s);
		return Math.floor(fullCount * clamp(1.35 - d / (H * 3.2), .5, 1));
	};
	needleMesh.onBeforeRender = (_r, _s, camera) => {
		if (camera.userData.isMirror) return;
		needleMesh.count = lodCount(camera);
	};
	needleMesh.onBeforeShadow = () => needleMesh.count = fullCount;
	let preMat = null;
	if (opts.prepass) {
		preMat = prepassMaterial(needleMat);
		equalDepthMaterial(needleMat, "needle");
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
		stats: {
			needles: clusters.length,
			anchors: anchors.length,
			tips: tips.length
		},
		dispose() {
			barkMesh.geometry.dispose();
			needleMesh.geometry.dispose();
			barkMat.dispose();
			needleMat.dispose();
			needleMesh.dispose();
			preMat?.dispose();
		}
	};
}
// src/decor/shapes.js
var ORNAMENT_SHAPES = [
	"ball",
	"drop",
	"star",
	"bell",
	"heart",
	"snowflake"
];
function dropGeometry(radial) {
	const pts = [];
	for (let i = 0; i <= 16; i++) {
		const t = i / 16;
		const y = lerp(-1.6, 1, t);
		const r = t < .62 ? Math.sin(t / .62 * Math.PI * .5) ** .7 : Math.cos((t - .62) / .38 * Math.PI * .5);
		pts.push(new THREE.Vector2(Math.max(.001, r * (t < .62 ? .75 + t * .4 : 1)), y));
	}
	return new THREE.LatheGeometry(pts, radial);
}
function starGeometry() {
	const shape = new THREE.Shape();
	for (let i = 0; i < 10; i++) {
		const r = i % 2 ? .45 : 1;
		const a = i / 10 * Math.PI * 2 + Math.PI / 2;
		i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
	}
	const g = new THREE.ExtrudeGeometry(shape, {
		depth: .3,
		bevelEnabled: true,
		bevelSize: .08,
		bevelThickness: .08,
		bevelSegments: 2
	});
	g.center();
	return g;
}
function heartGeometry() {
	const h = new THREE.Shape();
	h.moveTo(0, -1);
	h.bezierCurveTo(1.3, -.1, .9, .95, 0, .45);
	h.bezierCurveTo(-.9, .95, -1.3, -.1, 0, -1);
	const g = new THREE.ExtrudeGeometry(h, {
		depth: .35,
		bevelEnabled: true,
		bevelSize: .1,
		bevelThickness: .1,
		bevelSegments: 2
	});
	g.center();
	return g;
}
function bellGeometry() {
	const pts = [];
	for (let i = 0; i <= 12; i++) {
		const t = i / 12;
		pts.push(new THREE.Vector2((.18 + .82 * Math.pow(t, 2.2)) * (t > .92 ? 1.08 : 1), 1 - t * 1.6));
	}
	const g = new THREE.LatheGeometry(pts, 18);
	const clapper = new THREE.SphereGeometry(.22, 10, 8).translate(0, -.62, 0);
	const merged = mergeGeometries([g.toNonIndexed(), clapper.toNonIndexed()]);
	merged.center();
	return merged;
}
function snowflakeGeometry() {
	const parts = [];
	for (let i = 0; i < 3; i++) {
		const b = new THREE.BoxGeometry(2, .16, .12);
		b.rotateZ(i / 3 * Math.PI);
		parts.push(b);
		for (const d of [-1, 1]) {
			const twig = new THREE.BoxGeometry(.5, .1, .1);
			twig.rotateZ(.8);
			twig.translate(.6 * d, .15, 0);
			twig.rotateZ(i / 3 * Math.PI);
			parts.push(twig);
		}
	}
	return mergeGeometries(parts.map((p) => p.toNonIndexed()));
}
function ornamentGeometry(shape, detail = "high") {
	const low = detail === "low";
	switch (shape) {
		case "drop": return dropGeometry(low ? 9 : 20);
		case "star": return starGeometry();
		case "bell": return bellGeometry();
		case "heart": return heartGeometry();
		case "snowflake": return snowflakeGeometry();
		default: return low ? new THREE.SphereGeometry(1, 10, 7) : new THREE.SphereGeometry(1, 18, 12);
	}
}
var HAS_CAP = /* @__PURE__ */ new Set(["ball", "drop"]);
// src/decor/decorate.js
var DECOR_DEFAULTS = {
	ornaments: 620,
	ornamentSize: 1,
	ornamentShapes: {
		ball: .78,
		drop: .22
	},
	palette: "classic",
	lights: 2200,
	lightColor: "warm",
	trunkLights: true,
	garland: true,
	garlandColor: "#f0c25a",
	beads: true,
	beadColors: ["#f3f0ea", "#b0141e"],
	topper: "star",
	topperColor: "#ffd76a",
	presents: 26,
	base: "bed",
	skirtColor: "#9c1018",
	glowLights: true
};
var PALETTES = {
	classic: [
		"#a5121c",
		"#c99a2e",
		"#d6dbe2",
		"#a5121c",
		"#c99a2e"
	],
	"red-gold": [
		"#9c0f19",
		"#c4141f",
		"#d4a537",
		"#e2b84c"
	],
	"silver-blue": [
		"#c8d0da",
		"#1d3f8f",
		"#2f63c2",
		"#e7ecf2"
	],
	rainbow: [
		"#b3121f",
		"#d4a43a",
		"#1d4f9f",
		"#0f7a45",
		"#8c2a8f",
		"#d9dee6"
	],
	candy: [
		"#e23b5a",
		"#f4f4f4",
		"#ff8fc7",
		"#f4f4f4"
	],
	forest: [
		"#7a1414",
		"#2f5d3a",
		"#c99a2e",
		"#e8dcc2"
	]
};
var LIGHT_COLORS = {
	warm: [[
		1,
		.72,
		.38
	]],
	cool: [[
		.75,
		.85,
		1
	]],
	multi: [
		[
			1,
			.18,
			.12
		],
		[
			.2,
			.9,
			.3
		],
		[
			.25,
			.45,
			1
		],
		[
			1,
			.75,
			.15
		],
		[
			.95,
			.3,
			.8
		]
	],
	"red-green": [
		[
			1,
			.15,
			.1
		],
		[
			.2,
			.95,
			.3
		],
		[
			1,
			.7,
			.35
		]
	]
};
var resolvePalette = (p) => Array.isArray(p) && p.length ? p : PALETTES[p] ?? PALETTES.classic;
var resolveLights = (l) => {
	if (Array.isArray(l) && l.length) return l.map((c) => typeof c === "string" ? new THREE.Color(c).toArray() : c);
	return LIGHT_COLORS[l] ?? LIGHT_COLORS.warm;
};
function pickSpread(cands, count, minDist, rand) {
	const pool = cands.slice();
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(rand() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}
	const out = [];
	const md2 = minDist * minDist;
	for (const c of pool) {
		if (out.length >= count) break;
		if (out.every((o) => o.p.distanceToSquared(c.p) > md2)) out.push(c);
	}
	return out;
}
function topperGeometry() {
	const pos = [];
	const ring = [];
	for (let i = 0; i < 10; i++) {
		const r = i % 2 ? .15 : .36;
		const a = i / 10 * Math.PI * 2 + Math.PI / 2;
		ring.push([
			Math.cos(a) * r,
			Math.sin(a) * r,
			0
		]);
	}
	const front = [
		0,
		0,
		.12
	];
	const back = [
		0,
		0,
		-.12
	];
	for (let i = 0; i < 10; i++) {
		const a = ring[i];
		const b = ring[(i + 1) % 10];
		pos.push(...front, ...a, ...b, ...back, ...b, ...a);
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
	g.computeVertexNormals();
	return g;
}
function buildPresent(rand, w, h, d, base, accent, style) {
	const g = new THREE.Group();
	const tex = wrapTexture(base, accent, style)?.clone() ?? null;
	if (tex) {
		tex.needsUpdate = true;
		tex.repeat.set(Math.max(1, w * 2), Math.max(1, h * 2));
	}
	const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({
		map: tex,
		color: tex ? "#ffffff" : base,
		roughness: .6
	}));
	box.userData.mergeKey = `wrap-${base}-${accent}-${style}`;
	box.position.y = h / 2;
	const ribbonCol = rand() < .5 ? "#d8b24a" : "#f2f2f2";
	const ribbonMat = new THREE.MeshStandardMaterial({
		color: ribbonCol,
		metalness: .4,
		roughness: .35
	});
	const rk = Math.max(1, Math.min(w, d) / .35);
	const r1 = new THREE.Mesh(new THREE.BoxGeometry(w + .01, h + .01, .06 * rk), ribbonMat);
	const r2 = new THREE.Mesh(new THREE.BoxGeometry(.06 * rk, h + .01, d + .01), ribbonMat);
	r1.position.y = r2.position.y = h / 2;
	const bowGeo = new THREE.TorusGeometry(.07 * rk, .022 * rk, 8, 16);
	const b1 = new THREE.Mesh(bowGeo, ribbonMat);
	const b2 = new THREE.Mesh(bowGeo, ribbonMat);
	b1.position.set(-.06 * rk, h + .05 * rk, 0);
	b2.position.set(.06 * rk, h + .05 * rk, 0);
	b1.rotation.set(0, Math.PI / 2, .5);
	b2.rotation.set(0, Math.PI / 2, -.5);
	b1.scale.set(1, .7, 1);
	b2.scale.set(1, .7, 1);
	for (const m of [
		r1,
		r2,
		b1,
		b2
	]) m.userData.mergeKey = `ribbon-${ribbonCol}`;
	for (const m of [
		box,
		r1,
		r2,
		b1,
		b2
	]) g.add(m);
	return g;
}
function buildBed(tree, group, keep) {
	const bedR = Math.max(3.2, tree.trunkRadius * 5.5);
	const curbGeo = keep(new THREE.LatheGeometry([
		new THREE.Vector2(bedR + .3, -.05),
		new THREE.Vector2(bedR + .3, .36),
		new THREE.Vector2(bedR + .22, .44),
		new THREE.Vector2(bedR - .26, .44),
		new THREE.Vector2(bedR - .34, .36),
		new THREE.Vector2(bedR - .32, -.05)
	], 72));
	const stone = stoneTexture()?.clone() ?? null;
	if (stone) {
		stone.needsUpdate = true;
		stone.repeat.set(14, 1);
	}
	const curb = new THREE.Mesh(curbGeo, keep(new THREE.MeshStandardMaterial({
		map: stone,
		color: stone ? "#d8d2c8" : "#77736d",
		roughness: .92
	})));
	if (stone) keep(stone);
	curb.castShadow = true;
	curb.receiveShadow = true;
	const capSnow = new THREE.Mesh(keep(new THREE.TorusGeometry(bedR - .02, .2, 8, 72).scale(1, 1, .32)), keep(new THREE.MeshStandardMaterial({
		color: "#eef3fa",
		roughness: .85
	})));
	capSnow.rotation.x = Math.PI / 2;
	capSnow.position.y = .46;
	capSnow.receiveShadow = true;
	const r0 = tree.trunkRadius * .9;
	const moundPts = [];
	for (let i = 0; i <= 12; i++) {
		const u = i / 12;
		moundPts.push(new THREE.Vector2(lerp(r0, bedR - .3, u), lerp(.48, .3, Math.pow(u, .6))));
	}
	const mound = new THREE.Mesh(keep(new THREE.LatheGeometry(moundPts, 72)), keep(new THREE.MeshStandardMaterial({
		color: "#e4ebf5",
		roughness: .9,
		side: THREE.DoubleSide
	})));
	mound.receiveShadow = true;
	const posts = 16;
	const m = new THREE.Matrix4();
	const postMesh = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(.045, .055, .7, 8)), keep(new THREE.MeshStandardMaterial({
		color: "#1f2a24",
		metalness: .7,
		roughness: .45
	})), posts);
	const knobMesh = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(.075, 12, 8)), keep(new THREE.MeshStandardMaterial({
		color: "#caa24a",
		metalness: 1,
		roughness: .3
	})), posts);
	const postR = bedR + .02;
	for (let i = 0; i < posts; i++) {
		const a = i / posts * Math.PI * 2;
		m.makeTranslation(Math.cos(a) * postR, .79, Math.sin(a) * postR);
		postMesh.setMatrixAt(i, m);
		m.makeTranslation(Math.cos(a) * postR, 1.18, Math.sin(a) * postR);
		knobMesh.setMatrixAt(i, m);
	}
	const ropePts = [];
	for (let i = 0; i <= 192; i++) {
		const u = i / 12;
		const a = u / posts * Math.PI * 2;
		const sag = Math.sin(u % 1 * Math.PI) * .16;
		ropePts.push(new THREE.Vector3(Math.cos(a) * postR, 1.06 - sag, Math.sin(a) * postR));
	}
	const rope = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePts, true), 384, .022, 5, true)), keep(new THREE.MeshStandardMaterial({
		color: "#9c1018",
		roughness: .55
	})));
	postMesh.castShadow = true;
	rope.castShadow = true;
	keep(postMesh);
	keep(knobMesh);
	group.add(curb, capSnow, mound, postMesh, knobMesh, rope);
	return {
		radius: bedR - .4,
		floor: (r) => lerp(.48, .3, Math.pow(clamp((r - r0) / (bedR - .3 - r0), 0, 1), .6))
	};
}
function buildSkirt(tree, group, keep, color) {
	const R = Math.max(3.4, tree.trunkRadius * 6);
	const pts = [];
	for (let i = 0; i <= 16; i++) {
		const u = i / 16;
		pts.push(new THREE.Vector2(lerp(tree.trunkRadius * .95, R, u), lerp(.22, .03, Math.pow(u, .5))));
	}
	const geo = keep(new THREE.LatheGeometry(pts, 96));
	const pos = geo.attributes.position;
	for (let i = 0; i < pos.count; i++) {
		const x = pos.getX(i);
		const z = pos.getZ(i);
		const r = Math.hypot(x, z);
		const a = Math.atan2(z, x);
		pos.setY(i, pos.getY(i) + Math.sin(a * 9) * .05 * (r / R));
	}
	geo.computeVertexNormals();
	const cloth = new THREE.Mesh(geo, keep(new THREE.MeshStandardMaterial({
		color,
		roughness: .95,
		side: THREE.DoubleSide
	})));
	cloth.receiveShadow = true;
	const rim = new THREE.Mesh(keep(new THREE.TorusGeometry(R, .14, 8, 96).scale(1, 1, .6)), keep(new THREE.MeshStandardMaterial({
		color: "#f4f1ea",
		roughness: 1
	})));
	rim.rotation.x = Math.PI / 2;
	rim.position.y = .06;
	rim.receiveShadow = true;
	group.add(cloth, rim);
	return {
		radius: R - .3,
		floor: (r) => lerp(.22, .03, Math.pow(clamp(r / R, 0, 1), .5))
	};
}
function buildDecorations(tree, input, uniforms) {
	const params = {
		...DECOR_DEFAULTS,
		...input
	};
	const rand = mulberry32(tree.params.seed * 31 + 7);
	const H = tree.height;
	const K = H / 7.2;
	const group = new THREE.Group();
	group.name = "decor";
	const disposables = [];
	const keep = (o) => (disposables.push(o), o);
	const m = new THREE.Matrix4();
	const q = new THREE.Quaternion();
	const col = new THREE.Color();
	const palette = resolvePalette(params.palette);
	const shapeW = Object.entries(params.ornamentShapes ?? { ball: 1 }).filter(([, w]) => w > 0);
	const shapeSum = shapeW.reduce((s, [, w]) => s + w, 0) || 1;
	const pickShape = () => {
		let r = rand() * shapeSum;
		for (const [k, w] of shapeW) if ((r -= w) <= 0) return k;
		return shapeW[0]?.[0] ?? "ball";
	};
	const spots = pickSpread(tree.anchors.filter((a) => rand() < clamp((a.p.y - tree.crownBase) / 2.5, .2, 1)), params.ornaments, .32 * Math.sqrt(K), rand);
	const byShape = /* @__PURE__ */ new Map();
	for (const s of spots) {
		const k = pickShape();
		if (!byShape.has(k)) byShape.set(k, []);
		byShape.get(k).push(s);
	}
	const ornMat = keep(new THREE.MeshPhysicalMaterial({
		metalness: .85,
		roughness: .16,
		clearcoat: 1,
		clearcoatRoughness: .08
	}));
	const capMat = keep(new THREE.MeshStandardMaterial({
		color: "#c9a548",
		metalness: 1,
		roughness: .3
	}));
	const capMesh = new THREE.InstancedMesh(keep(new THREE.CylinderGeometry(.2, .2, .25, 10)), capMat, Math.max(1, spots.length));
	const ornamentLods = [];
	let capIdx = 0;
	const up = new THREE.Vector3(0, 1, 0);
	for (const [shape, list] of byShape) {
		const high = keep(ornamentGeometry(shape, "high"));
		const low = shape === "ball" || shape === "drop" ? keep(ornamentGeometry(shape, "low")) : high;
		const mesh = new THREE.InstancedMesh(high, ornMat, list.length);
		mesh.name = `ornaments-${shape}`;
		ornamentLods.push({
			mesh,
			high,
			low
		});
		const flat = !HAS_CAP.has(shape) && shape !== "bell";
		list.forEach((s, i) => {
			const size = lerp(.12, .07, clamp(s.p.y / H, 0, 1)) * Math.pow(K, .75) * (.85 + rand() * .3) * params.ornamentSize * (flat ? .95 : 1);
			const pos = s.p.clone();
			pos.y -= size * 1.4 + .03 * K;
			pos.addScaledVector(new THREE.Vector3(s.p.x, 0, s.p.z).normalize(), .04);
			q.setFromAxisAngle(up, flat ? Math.atan2(s.p.x, s.p.z) + (rand() - .5) * .6 : rand() * 6.28);
			m.compose(pos, q, new THREE.Vector3(size, size, size));
			mesh.setMatrixAt(i, m);
			mesh.setColorAt(i, col.set(palette[Math.floor(rand() * palette.length)]));
			if (HAS_CAP.has(shape)) {
				m.compose(pos.clone().setY(pos.y + size * 1.02), q, new THREE.Vector3(size, size, size));
				capMesh.setMatrixAt(capIdx++, m);
			}
		});
		mesh.castShadow = true;
		group.add(mesh);
		keep(mesh);
	}
	capMesh.count = capIdx;
	group.add(capMesh);
	keep(capMesh);
	const lightCols = resolveLights(params.lightColor);
	const lightSpots = pickSpread(tree.tips.filter((t) => t.p.y > .4 * K), params.lights, .2 * Math.sqrt(K), rand);
	if (params.lights > 0 && params.trunkLights) {
		const top = tree.crownBase + .4;
		const n = 150;
		for (let i = 0; i < n; i++) {
			const u = i / 149;
			const y = lerp(.35, top, u);
			const a = u * 7 * Math.PI * 2;
			const r = tree.trunkAt(y).r + .035;
			const d = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
			lightSpots.push({
				p: new THREE.Vector3(d.x * r - d.x * .05, y - .02, d.z * r - d.z * .05),
				d
			});
		}
	}
	const bulbMat = keep(createBulbMaterial(uniforms));
	const bulbs = new THREE.InstancedMesh(keep(new THREE.IcosahedronGeometry(.028 * Math.sqrt(K), 0)), bulbMat, Math.max(1, lightSpots.length));
	bulbs.name = "bulbs";
	bulbs.count = lightSpots.length;
	lightSpots.forEach((s, i) => {
		m.makeTranslation(s.p.x + s.d.x * .05, s.p.y + .02, s.p.z + s.d.z * .05);
		bulbs.setMatrixAt(i, m);
		const c = lightCols[Math.floor(rand() * lightCols.length)];
		bulbs.setColorAt(i, col.setRGB(c[0], c[1], c[2]));
	});
	setBulbPhases(bulbs, rand);
	group.add(bulbs);
	keep(bulbs);
	const helix = (phase, turns, inset, sag) => {
		const pts = [];
		const top = H * .86;
		const bottom = tree.crownBase + H * .04;
		for (let i = 0; i <= 500; i++) {
			const u = i / 500;
			const theta = u * turns * Math.PI * 2 + phase;
			let y = lerp(top, bottom, u);
			const seg = theta / (Math.PI / 2.5) % 1;
			y -= sag * Math.sin(seg * Math.PI) * lerp(.6, 1.2, u);
			const r = tree.envAt(y) * inset + .02;
			pts.push(new THREE.Vector3(Math.cos(theta) * r, y, Math.sin(theta) * r));
		}
		return pts;
	};
	if (params.garland) {
		const gc = new THREE.Color(params.garlandColor);
		const curve = new THREE.CatmullRomCurve3(helix(0, 5, .82, .2 * K));
		const core = new THREE.Mesh(keep(new THREE.TubeGeometry(curve, 1400, .012 * K, 4)), keep(new THREE.MeshStandardMaterial({
			color: gc.clone().multiplyScalar(.7),
			metalness: 1,
			roughness: .4
		})));
		core.name = "garland";
		group.add(core);
		const n = Math.floor(curve.getLength() / (.008 * K));
		const tinselMat = keep(new THREE.MeshStandardMaterial({
			color: gc,
			metalness: 1,
			roughness: .42,
			side: THREE.DoubleSide,
			emissive: gc.clone().multiplyScalar(.25),
			emissiveIntensity: .6
		}));
		const tinsel = new THREE.InstancedMesh(keep(new THREE.PlaneGeometry(.1 * K, .007 * K)), tinselMat, n * 2);
		tinsel.name = "tinsel";
		const e = new THREE.Euler();
		const sc = new THREE.Vector3();
		for (let i = 0; i < n * 2; i++) {
			const p = curve.getPointAt((i >> 1) / n);
			q.setFromEuler(e.set(rand() * 6.28, rand() * 6.28, rand() * 6.28));
			sc.setScalar(.6 + rand() * .7);
			m.compose(p, q, sc);
			tinsel.setMatrixAt(i, m);
			const v = .75 + rand() * .5;
			tinsel.setColorAt(i, col.setRGB(v, v * (.92 + rand() * .1), v * .85));
		}
		group.add(tinsel);
		keep(tinsel);
	}
	if (params.beads) {
		const curve = new THREE.CatmullRomCurve3(helix(Math.PI, 4.4, .86, .14 * K));
		const n = Math.floor(curve.getLength() / (.055 * K));
		const beadCols = params.beadColors?.length ? params.beadColors : DECOR_DEFAULTS.beadColors;
		const beads = new THREE.InstancedMesh(keep(new THREE.SphereGeometry(.022 * K, 6, 4)), keep(new THREE.MeshPhysicalMaterial({
			metalness: .3,
			roughness: .2,
			clearcoat: 1
		})), n);
		beads.name = "beads";
		for (let i = 0; i < n; i++) {
			m.makeTranslation(curve.getPointAt(i / n));
			beads.setMatrixAt(i, m);
			beads.setColorAt(i, col.set(beadCols[i % beadCols.length]));
		}
		group.add(beads);
		keep(beads);
	}
	const inner = [];
	let star = null;
	let starMesh = null;
	let halo = null;
	if (params.topper === "star") {
		star = new THREE.Group();
		star.name = "topper";
		const tc = new THREE.Color(params.topperColor);
		const starMat = keep(new THREE.MeshStandardMaterial({
			color: tc,
			emissive: tc.clone().lerp(new THREE.Color("#ff8a00"), .35),
			emissiveIntensity: 1.3,
			metalness: .7,
			roughness: .22,
			flatShading: true
		}));
		starMesh = new THREE.Mesh(keep(topperGeometry()), starMat);
		starMesh.scale.setScalar(K * .95);
		star.add(starMesh);
		halo = new THREE.Sprite(keep(new THREE.SpriteMaterial({
			map: glowTexture(),
			color: tc,
			blending: THREE.AdditiveBlending,
			depthWrite: false,
			transparent: true
		})));
		halo.scale.setScalar(1.5 * K);
		star.add(halo);
		if (params.glowLights) {
			const l = new THREE.PointLight(tc.clone().lerp(new THREE.Color("#ffcc77"), .6), 6 * K * K, 9 * K, 2);
			inner.push([l, 6]);
			star.add(l);
		}
		star.position.set(0, H + .32 * K, 0);
		group.add(star);
	}
	if (params.glowLights && params.lights > 0) {
		const glowCol = lightCols.length > 1 ? "#ffd2a0" : new THREE.Color(...lightCols[0]).getStyle();
		const a = new THREE.PointLight(glowCol, 9 * K * K, 9 * K, 2);
		a.position.set(0, H * .25, 0);
		const b = new THREE.PointLight(glowCol, 6 * K * K, 7 * K, 2);
		b.position.set(0, H * .55, 0);
		inner.push([a, 9], [b, 6]);
		group.add(a, b);
	}
	let ground = {
		radius: Math.max(3, tree.trunkRadius * 5),
		floor: () => 0
	};
	if (params.base === "bed") ground = buildBed(tree, group, keep);
	else if (params.base === "skirt") ground = buildSkirt(tree, group, keep, params.skirtColor);
	const wraps = [
		["#b3121f", "#f4ead8"],
		["#14532d", "#e8c25a"],
		["#1e3a8a", "#e5e7eb"],
		["#f4ead8", "#b3121f"],
		["#6b1a6f", "#e8c25a"],
		["#c99a2e", "#7a1414"]
	];
	const presents = new THREE.Group();
	for (let i = 0; i < params.presents; i++) {
		const a = i / params.presents * Math.PI * 2 + rand() * .4;
		const r = lerp(tree.trunkRadius * 1.9, ground.radius - .35, rand());
		const w = (.28 + rand() * .32) * K * .6;
		const h = (.2 + rand() * .3) * K * .6;
		const d = (.26 + rand() * .3) * K * .6;
		const [base, accent] = wraps[Math.floor(rand() * wraps.length)];
		const p = buildPresent(rand, w, h, d, base, accent, Math.floor(rand() * 3));
		const y0 = ground.floor(r) - .03;
		p.position.set(Math.cos(a) * r, y0, Math.sin(a) * r);
		p.rotation.y = rand() * Math.PI;
		presents.add(p);
		if (rand() < .3) {
			const [b2, a2] = wraps[Math.floor(rand() * wraps.length)];
			const small = buildPresent(rand, w * .6, h * .6, d * .6, b2, a2, Math.floor(rand() * 3));
			small.position.set(p.position.x, y0 + h, p.position.z);
			small.rotation.y = rand() * Math.PI;
			presents.add(small);
		}
	}
	presents.updateMatrixWorld(true);
	const buckets = /* @__PURE__ */ new Map();
	const freed = /* @__PURE__ */ new Set();
	presents.traverse((o) => {
		if (!o.isMesh) return;
		const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
		const map = o.material.map;
		if (map) {
			const uv = g.attributes.uv;
			for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * map.repeat.x, uv.getY(k) * map.repeat.y);
		}
		const key = o.userData.mergeKey;
		if (!buckets.has(key)) buckets.set(key, {
			geos: [],
			mat: o.material
		});
		const b = buckets.get(key);
		b.geos.push(g.index ? g.toNonIndexed() : g);
		if (o.material !== b.mat && !freed.has(o.material)) {
			freed.add(o.material);
			o.material.map?.dispose();
			o.material.dispose();
		}
		o.geometry.dispose();
	});
	for (const { geos, mat } of buckets.values()) {
		if (mat.map) {
			mat.map.repeat.set(1, 1);
			mat.map.needsUpdate = true;
		}
		const merged = new THREE.Mesh(keep(mergeGeometries(geos)), keep(mat));
		if (mat.map) keep(mat.map);
		merged.name = "presents";
		merged.castShadow = true;
		merged.receiveShadow = true;
		group.add(merged);
		for (const g of geos) g.dispose();
	}
	const baseStar = star?.position.y ?? 0;
	const _c = new THREE.Vector3();
	const _inv = new THREE.Matrix4();
	const perFrame = (camera) => {
		const t = uniforms.uTime.value;
		_inv.copy(group.matrixWorld).invert();
		camera.getWorldPosition(_c).applyMatrix4(_inv);
		const d = Math.hypot(_c.x, _c.y - H * .45, _c.z);
		for (const l of ornamentLods) {
			if (l.low === l.high) continue;
			const far = l.mesh.geometry === l.low ? d > H * 1.1 : d > H * 1.25;
			l.mesh.geometry = far ? l.low : l.high;
		}
		if (star) {
			starMesh.rotation.y = Math.atan2(_c.x, _c.z) + Math.sin(t * .4) * .25;
			star.position.y = baseStar + Math.sin(t * 1.3) * .02 * K;
			halo.material.opacity = .45 + Math.sin(t * 2.1) * .1;
		}
		const flick = .92 + Math.sin(t * 7.1) * .04 + Math.sin(t * 13.7) * .03;
		const ls = api.lightScale;
		for (const [l, base] of inner) {
			l.intensity = base * K * K * flick * uniforms.uGlow.value / 3 * ls * ls;
			l.distance = l.userData.baseDistance * ls;
		}
	};
	for (const [l] of inner) l.userData.baseDistance = l.distance;
	const api = {
		lightScale: 1,
		group,
		params,
		bulbs,
		stats: {
			ornaments: spots.length,
			lights: lightSpots.length
		},
		perFrame,
		dispose() {
			group.traverse((o) => {
				if (o.isMesh && !disposables.includes(o.geometry)) o.geometry.dispose?.();
			});
			for (const d of disposables) d.dispose?.();
		}
	};
	return api;
}
// src/decor/ornaments.js
var CAP = 2048;
var nextId = 1;
function createOrnamentLayer(tree, { size = 1, capacity = CAP } = {}) {
	const group = new THREE.Group();
	group.name = "ornament-layer";
	let shape = tree;
	const base = () => .2 * (shape.height / 20);
	const geos = ORNAMENT_SHAPES.map((k) => ornamentGeometry(k));
	const mat = new THREE.MeshStandardMaterial({
		color: "#ffffff",
		metalness: .55,
		roughness: .28,
		envMapIntensity: 2.2
	});
	mat.onBeforeCompile = (sh) => {
		sh.fragmentShader = sh.fragmentShader.replace("#include <emissivemap_fragment>", "#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * 0.32;");
	};
	mat.customProgramCacheKey = () => "xtk-ornament";
	const meshes = geos.map((g, k) => {
		const m = new THREE.InstancedMesh(g, mat, capacity);
		m.name = `user-ornaments-${ORNAMENT_SHAPES[k]}`;
		m.count = 0;
		m.frustumCulled = false;
		m.castShadow = true;
		m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
		group.add(m);
		return m;
	});
	const slots = meshes.map(() => []);
	const byId = /* @__PURE__ */ new Map();
	const hooks = {
		onAdd: null,
		onRemove: null,
		onArrive: null
	};
	const _m = new THREE.Matrix4();
	const _q = new THREE.Quaternion();
	const _e = new THREE.Euler();
	const _p = new THREE.Vector3();
	const _s = new THREE.Vector3();
	const _c = new THREE.Color();
	function toLocal(o, out = new THREE.Vector3()) {
		const y = clamp(o.h, 0, 1) * shape.height;
		const rad = shape.envAt(y) * (o.r ?? .92);
		return out.set(Math.cos(o.a) * rad, y, Math.sin(o.a) * rad);
	}
	function fromLocal(p) {
		const y = clamp(p.y, 0, shape.height);
		const env = Math.max(.05, shape.envAt(y));
		return {
			h: y / shape.height,
			a: Math.atan2(p.z, p.x),
			r: clamp(Math.hypot(p.x, p.z) / env, 0, 1.2)
		};
	}
	function place(o, scale = 1, at = null, spin = 0) {
		const k = ORNAMENT_SHAPES.indexOf(o.shape);
		const i = slots[k].indexOf(o);
		if (i < 0) return;
		const p = at ?? toLocal(o, _p);
		_e.set(0, Math.atan2(p.x, p.z) + spin, 0);
		_q.setFromEuler(_e);
		const s = base() * (o.size ?? 1) * size * scale;
		_m.compose(p, _q, _s.set(s, s, s));
		meshes[k].setMatrixAt(i, _m);
		meshes[k].setColorAt(i, _c.set(o.color));
		meshes[k].instanceMatrix.needsUpdate = true;
		meshes[k].instanceColor.needsUpdate = true;
		meshes[k].boundingSphere = null;
		meshes[k].boundingBox = null;
	}
	function add(input, { from = null, animate = true } = {}) {
		const o = {
			id: input.id ?? `o${nextId++}`,
			shape: ORNAMENT_SHAPES.includes(input.shape) ? input.shape : "ball",
			color: input.color ?? "#e23b3b",
			h: input.h ?? .5,
			a: input.a ?? 0,
			r: input.r ?? .92,
			size: input.size ?? 1,
			data: input.data ?? null
		};
		if (byId.has(o.id)) remove(o.id);
		const k = ORNAMENT_SHAPES.indexOf(o.shape);
		if (meshes[k].count >= capacity) return null;
		slots[k].push(o);
		meshes[k].count = slots[k].length;
		byId.set(o.id, o);
		if (from) {
			const to = toLocal(o);
			const p0 = group.worldToLocal(from.clone());
			const out = new THREE.Vector3(to.x, 0, to.z).normalize();
			const H = shape.height;
			const p1 = p0.clone().add(new THREE.Vector3(0, H * .16, 0));
			const p2 = to.clone().addScaledVector(out, H * .15).add(new THREE.Vector3(0, H * .08, 0));
			const dur = clamp(1.5 + p0.distanceTo(to) / H * 1, 1.7, 2.8);
			o._fly = {
				p0,
				p1,
				p2,
				p3: to,
				t0: now(),
				dur
			};
			place(o, 2.2, p0);
		} else if (animate) {
			o._born = now();
			place(o, .01);
		} else place(o);
		hooks.onAdd?.(o);
		return o;
	}
	function remove(id) {
		const o = byId.get(id);
		if (!o) return false;
		const k = ORNAMENT_SHAPES.indexOf(o.shape);
		const list = slots[k];
		const i = list.indexOf(o);
		const last = list.pop();
		if (last !== o) {
			list[i] = last;
			place(last);
		}
		meshes[k].count = list.length;
		meshes[k].boundingSphere = null;
		meshes[k].boundingBox = null;
		byId.delete(id);
		if (lit === o) lit = null;
		hooks.onRemove?.(o);
		return true;
	}
	function clear() {
		for (const id of [...byId.keys()]) remove(id);
	}
	function relayout(nextShape) {
		shape = nextShape;
		for (const o of byId.values()) place(o);
	}
	const bez = (a, b, c, d, t, out) => {
		const u = 1 - t;
		return out.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * t).addScaledVector(c, 3 * u * t * t).addScaledVector(d, t * t * t);
	};
	const now = () => performance.now() / 1e3;
	const _f = new THREE.Vector3();
	let lit = null;
	function update() {
		const t1 = now();
		for (const o of byId.values()) if (o._fly) {
			const t = Math.min(1, (t1 - o._fly.t0) / o._fly.dur);
			const e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
			bez(o._fly.p0, o._fly.p1, o._fly.p2, o._fly.p3, e, _f);
			_f.y += Math.sin(t * Math.PI * 3) * .008 * shape.height * (1 - t);
			place(o, 2.2 - 1.2 * e, _f, (1 - e) * Math.PI * 4);
			if (t >= 1) {
				o._fly = null;
				o._born = t1;
				hooks.onArrive?.(o);
			}
		} else if (o._born) {
			const t = Math.min(1, (t1 - o._born) / .6);
			place(o, Math.max(.01, 1 + Math.sin(t * Math.PI) * .6 * (1 - t)));
			if (t >= 1) o._born = 0;
		}
		if (lit && !lit._fly && !lit._born) place(lit, 1.25 + Math.sin(t1 * 5) * .12);
	}
	function highlight(o) {
		if (lit && lit !== o && byId.has(lit.id)) place(lit);
		lit = o ? byId.get(o.id ?? o) ?? null : null;
	}
	const ray = new THREE.Raycaster();
	const setRay = (a, camera) => a instanceof THREE.Raycaster ? a : (ray.setFromCamera(a, camera), ray);
	function pick(ndcOrRay, camera) {
		const hit = setRay(ndcOrRay, camera).intersectObjects(meshes.filter((m) => m.count > 0), false)[0];
		if (!hit) return null;
		return slots[meshes.indexOf(hit.object)][hit.instanceId] ?? null;
	}
	let proxy = null;
	function buildProxy() {
		if (proxy) {
			group.remove(proxy);
			proxy.geometry.dispose();
		}
		const prof = [];
		const H = shape.height;
		const y0 = shape.crownBase * .9;
		for (let i = 0; i <= 40; i++) {
			const y = y0 + i / 40 * (H * .97 - y0);
			prof.push(new THREE.Vector2(shape.envAt(y) * .92 + .02, y));
		}
		proxy = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), proxyMat);
		proxy.name = "ornament-surface";
		group.add(proxy);
	}
	const proxyMat = new THREE.MeshBasicMaterial({
		visible: false,
		side: THREE.DoubleSide
	});
	buildProxy();
	function surfacePoint(ndcOrRay, camera) {
		const hit = setRay(ndcOrRay, camera).intersectObject(proxy, false)[0];
		if (!hit) return null;
		return {
			...fromLocal(group.worldToLocal(hit.point.clone())),
			r: .92,
			point: hit.point.clone()
		};
	}
	const ghostMat = new THREE.MeshBasicMaterial({
		color: "#fff",
		transparent: true,
		opacity: .8,
		depthWrite: false
	});
	const ghost = new THREE.Mesh(geos[0], ghostMat);
	ghost.name = "ornament-ghost";
	ghost.visible = false;
	group.add(ghost);
	function preview(spot, shapeName = "ball", color = "#ffffff") {
		ghost.visible = !!spot;
		if (!spot) return;
		ghost.geometry = geos[Math.max(0, ORNAMENT_SHAPES.indexOf(shapeName))];
		ghostMat.color.set(color);
		toLocal(spot, ghost.position);
		ghost.rotation.set(0, Math.atan2(ghost.position.x, ghost.position.z), 0);
		ghost.scale.setScalar(base() * size * (1.15 + Math.sin(now() * 8) * .12));
	}
	const serialize = (o) => {
		const out = {
			id: o.id,
			shape: o.shape,
			color: o.color,
			h: +o.h.toFixed(4),
			a: +o.a.toFixed(4)
		};
		if (o.r !== .92) out.r = +o.r.toFixed(3);
		if (o.size !== 1) out.size = o.size;
		if (o.data != null) out.data = o.data;
		return out;
	};
	return {
		group,
		hooks,
		add,
		remove,
		clear,
		get: (id) => byId.get(id) ?? null,
		list: () => [...byId.values()],
		get count() {
			return byId.size;
		},
		pick,
		surfacePoint,
		preview,
		highlight,
		relayout(next) {
			relayout(next);
			buildProxy();
		},
		toLocal,
		update,
		toJSON: () => [...byId.values()].map(serialize),
		dispose() {
			for (const g of geos) g.dispose();
			for (const m of meshes) m.dispose();
			proxy?.geometry.dispose();
			mat.dispose();
			ghostMat.dispose();
			proxyMat.dispose();
		}
	};
}
// src/presets.js
var NO_DECOR = {
	ornaments: 0,
	lights: 0,
	garland: false,
	beads: false,
	presents: 0,
	base: "none",
	topper: "none",
	glowLights: false
};
var PRESETS = {
	classic: {
		tree: {},
		decor: {},
		snow: .5
	},
	cozy: {
		tree: {
			seed: 77,
			spread: 7.4,
			droop: .3
		},
		decor: {
			palette: "red-gold",
			base: "skirt",
			presents: 30
		},
		snow: 0
	},
	nordic: {
		tree: {
			seed: 314,
			spread: 5.4,
			whorls: 60,
			droop: .42,
			upturn: .4
		},
		decor: {
			palette: "silver-blue",
			lightColor: "cool",
			garland: false,
			beadColors: ["#e7ecf2", "#9fb4d6"],
			presents: 12,
			base: "skirt",
			skirtColor: "#e9edf2",
			topperColor: "#e8f0ff"
		},
		snow: .8
	},
	rainbow: {
		tree: { seed: 2024 },
		decor: {
			palette: "rainbow",
			lightColor: "multi",
			ornamentShapes: {
				ball: .5,
				drop: .15,
				star: .15,
				bell: .1,
				heart: .1
			},
			garland: false
		},
		snow: .3
	},
	candy: {
		tree: {
			seed: 1414,
			spread: 6.4
		},
		decor: {
			palette: "candy",
			lightColor: "red-green",
			ornamentShapes: {
				ball: .5,
				heart: .25,
				star: .25
			},
			garlandColor: "#ff9ec7",
			topperColor: "#ffd1e6",
			base: "skirt",
			skirtColor: "#f4f4f4"
		},
		snow: .2
	},
	snowy: {
		tree: { seed: 909 },
		decor: {
			...NO_DECOR,
			lights: 600
		},
		snow: 1
	},
	bare: {
		tree: { seed: 5 },
		decor: { ...NO_DECOR },
		snow: .3
	}
};
var QUALITY = {
	ultra: {
		whorls: 1,
		branchesPerWhorl: 1,
		twigs: 1,
		needles: 1,
		needleSize: 1,
		lights: 1,
		ornaments: 1
	},
	high: {
		whorls: .72,
		branchesPerWhorl: .85,
		twigs: .9,
		needles: .85,
		needleSize: 1.12,
		lights: .8,
		ornaments: .9
	},
	medium: {
		whorls: .52,
		branchesPerWhorl: .75,
		twigs: .75,
		needles: .75,
		needleSize: 1.3,
		lights: .55,
		ornaments: .7
	},
	low: {
		whorls: .42,
		branchesPerWhorl: .62,
		twigs: .6,
		needles: .65,
		needleSize: 1.75,
		lights: .32,
		ornaments: .5
	}
};
// src/christmas-tree.js
var FORMAT = "xmas-tree-kit";
var FORMAT_VERSION = 1;
var TREE_KEYS = new Set(Object.keys(TREE_DEFAULTS));
var _v2 = new THREE.Vector2();
var ChristmasTree = class ChristmasTree extends THREE.Group {
	constructor(options = {}) {
		super();
		this.name = "christmas-tree";
		this.type = "ChristmasTree";
		this.options = normalize(options);
		this.uniforms = options.uniforms ?? createUniforms();
		this.root = new THREE.Group();
		this.root.name = "tree-root";
		this.add(this.root);
		this.autoTime = options.autoTime ?? true;
		this._t0 = typeof performance !== "undefined" ? performance.now() : 0;
		this._tree = null;
		this._decor = null;
		this.ornaments = null;
		this.generate();
		for (const o of this.options.ornaments ?? []) this.ornaments.add(o, { animate: false });
		delete this.options.ornaments;
	}
	get resolved() {
		return resolve(this.options);
	}
	generate() {
		const r = resolve(this.options);
		this._disposeTree();
		const t0 = typeof performance !== "undefined" ? performance.now() : 0;
		this._tree = buildTree(r.tree, this.uniforms, {
			prepass: r.prepass,
			lod: r.lod,
			barkMap: r.barkMap,
			needleColor: r.needleColor,
			barkColor: r.barkColor
		});
		this.root.add(this._tree.group);
		this._buildDecor(r);
		if (this.ornaments) this.ornaments.relayout(this._tree);
		else {
			this.ornaments = createOrnamentLayer(this._tree, { size: r.ornamentScale });
			this.ornaments.hooks.onAdd = (o) => this.dispatchEvent({
				type: "ornamentadd",
				ornament: o
			});
			this.ornaments.hooks.onRemove = (o) => this.dispatchEvent({
				type: "ornamentremove",
				ornament: o
			});
			this.ornaments.hooks.onArrive = (o) => this.dispatchEvent({
				type: "ornamentarrive",
				ornament: o
			});
			this.root.add(this.ornaments.group);
		}
		this._applyLook(r);
		this._hookFrame();
		this.buildTime = (typeof performance !== "undefined" ? performance.now() : 0) - t0;
		this.dispatchEvent({ type: "generate" });
		return this;
	}
	set(patch = {}) {
		const prev = resolve(this.options);
		const o = this.options;
		for (const [k, v] of Object.entries(patch)) if (k === "tree" || k === "decor") o[k] = {
			...o[k],
			...v
		};
		else if (k === "ornaments") continue;
		else o[k] = v;
		if ("preset" in patch && !patch.tree) o.tree = { ...patch.tree ?? {} };
		if ("preset" in patch && !patch.decor) o.decor = { ...patch.decor ?? {} };
		const next = resolve(o);
		const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
		if (!same(prev.tree, next.tree) || prev.prepass !== next.prepass || prev.lod !== next.lod || prev.needleColor !== next.needleColor || prev.barkColor !== next.barkColor) this.generate();
		else {
			if (!same(prev.decor, next.decor)) this._buildDecor(next), this._hookFrame();
			this._applyLook(next);
		}
		return this;
	}
	loadPreset(name) {
		return this.set({
			preset: name,
			tree: {},
			decor: {}
		});
	}
	get size() {
		return this.options.size;
	}
	set size(v) {
		this.set({ size: v });
	}
	get snow() {
		return this.uniforms.uSnow.value;
	}
	set snow(v) {
		this.options.snow = v;
		this.uniforms.uSnow.value = v;
	}
	get glow() {
		return this.uniforms.uGlow.value;
	}
	set glow(v) {
		this.options.glow = v;
		this.uniforms.uGlow.value = v;
	}
	get twinkle() {
		return this.uniforms.uTwinkle.value;
	}
	set twinkle(v) {
		this.options.twinkle = v;
		this.uniforms.uTwinkle.value = v;
	}
	get footprint() {
		const s = this._scale;
		let crown = 0;
		for (let y = 0; y <= this._tree.height; y += this._tree.height / 24) crown = Math.max(crown, this._tree.envAt(y));
		return {
			height: this.options.size,
			trunkRadius: this._tree.trunkRadius * s * 1.6,
			crownRadius: crown * s
		};
	}
	get stats() {
		return {
			...this._tree.stats,
			...this._decor.stats,
			userOrnaments: this.ornaments.count,
			buildMs: Math.round(this.buildTime)
		};
	}
	addOrnament(o, opts) {
		return this.ornaments.add(o, opts);
	}
	removeOrnament(id) {
		return this.ornaments.remove(id);
	}
	pickOrnament(ndcOrRay, camera) {
		return this.ornaments.pick(ndcOrRay, camera);
	}
	surfacePoint(ndcOrRay, camera) {
		return this.ornaments.surfacePoint(ndcOrRay, camera);
	}
	ornamentPosition(o, target = new THREE.Vector3()) {
		this.ornaments.toLocal(this.ornaments.get(o.id ?? o) ?? o, target);
		return this.ornaments.group.localToWorld(target);
	}
	update(time) {
		if (typeof time === "number") {
			this.autoTime = false;
			this.uniforms.uTime.value = time;
		}
		this.ornaments.update();
	}
	toJSON() {
		const o = this.options;
		const out = {
			format: FORMAT,
			version: 1,
			preset: o.preset,
			size: o.size,
			quality: o.quality
		};
		if (Object.keys(o.tree).length) out.tree = { ...o.tree };
		if (Object.keys(o.decor).length) out.decor = { ...o.decor };
		for (const k of [
			"snow",
			"glow",
			"twinkle"
		]) if (o[k] != null) out[k] = o[k];
		out.ornaments = this.ornaments.toJSON();
		return out;
	}
	static fromJSON(json, extra = {}) {
		const data = typeof json === "string" ? JSON.parse(json) : json;
		if (data.format && data.format !== "xmas-tree-kit") throw new Error(`xmas-tree-kit: 알 수 없는 형식 ${data.format}`);
		const { format, version, ...rest } = data;
		return new ChristmasTree({
			...rest,
			...extra
		});
	}
	dispose() {
		this._disposeTree();
		this.ornaments?.dispose();
		this.root.clear();
	}
	get _scale() {
		return this.options.size / this._tree.height;
	}
	_buildDecor(r) {
		if (this._decor) {
			this.root.remove(this._decor.group);
			this._decor.dispose();
		}
		this._decor = buildDecorations(this._tree, r.decor, this.uniforms);
		this.root.add(this._decor.group);
	}
	_applyLook(r) {
		this.root.scale.setScalar(r.size / this._tree.height);
		this._decor.lightScale = r.size / this._tree.height;
		this.uniforms.uSnow.value = r.snow;
		this.uniforms.uGlow.value = r.glow;
		this.uniforms.uTwinkle.value = r.twinkle;
		const shadows = r.shadows;
		this.root.traverse((o) => {
			if (!o.isMesh || o.name === "bulbs") return;
			if (o.userData.xtkShadow == null) o.userData.xtkShadow = o.castShadow;
			o.castShadow = shadows && o.userData.xtkShadow;
		});
	}
	_disposeTree() {
		if (this._decor) {
			this.root.remove(this._decor.group);
			this._decor.dispose();
			this._decor = null;
		}
		if (this._tree) {
			this.root.remove(this._tree.group);
			this._tree.dispose();
			this._tree = null;
		}
	}
	_hookFrame() {
		const bark = this._tree.barkMesh;
		bark.onBeforeRender = (renderer, _scene, camera) => {
			if (camera.userData.isMirror) return;
			if (this.autoTime) this.uniforms.uTime.value = (performance.now() - this._t0) / 1e3;
			if (camera.isPerspectiveCamera) {
				const rt = renderer.getRenderTarget();
				const h = rt ? rt.height : renderer.getDrawingBufferSize(_v2).y;
				this.uniforms.uPx.value = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, h) / camera.zoom;
			}
			this._decor.perFrame(camera);
			this.ornaments.update();
		};
	}
};
function normalize(options) {
	const { uniforms, autoTime, tree = {}, decor = {}, ...rest } = options;
	const o = {
		preset: "classic",
		size: 2.4,
		quality: "high",
		tree: { ...tree },
		decor: { ...decor },
		...rest
	};
	for (const k of Object.keys(rest)) {
		if (k === "ornaments" && Array.isArray(rest[k])) continue;
		if (TREE_KEYS.has(k)) {
			o.tree[k] = rest[k];
			delete o[k];
		} else if (k in DECOR_DEFAULTS) {
			o.decor[k] = rest[k];
			delete o[k];
		}
	}
	return o;
}
function resolve(o) {
	const preset = PRESETS[o.preset] ?? PRESETS.classic;
	const q = QUALITY[o.quality] ?? QUALITY.high;
	const tree = {
		...TREE_DEFAULTS,
		...preset.tree,
		...o.tree
	};
	const ut = o.tree ?? {};
	if (ut.whorls == null) tree.whorls = Math.max(8, Math.round(tree.whorls * q.whorls));
	if (ut.branchesPerWhorl == null) tree.branchesPerWhorl = Math.max(4, Math.round(tree.branchesPerWhorl * q.branchesPerWhorl));
	if (ut.twigs == null) tree.twigs *= q.twigs;
	if (ut.needles == null) tree.needles *= q.needles;
	if (ut.needleSize == null) tree.needleSize *= q.needleSize;
	const decor = {
		...DECOR_DEFAULTS,
		...preset.decor,
		...o.decor
	};
	const ud = o.decor ?? {};
	if (ud.lights == null) decor.lights = Math.round(decor.lights * q.lights);
	if (ud.ornaments == null) decor.ornaments = Math.round(decor.ornaments * q.ornaments);
	return {
		tree,
		decor,
		size: o.size ?? 2.4,
		snow: o.snow ?? preset.snow ?? .5,
		glow: o.glow ?? 3,
		twinkle: o.twinkle ?? 2.2,
		shadows: o.shadows ?? true,
		prepass: !!o.prepass,
		lod: o.lod ?? true,
		ornamentScale: o.ornamentScale ?? 1,
		barkMap: o.barkMap,
		needleColor: o.needleColor,
		barkColor: o.barkColor
	};
}
// src/export.js
async function exportGLB(tree, { bake = true, needleRatio = 1, lights = false, userOrnaments = true, binary = true } = {}) {
	const scene = buildExportScene(tree, {
		bake,
		needleRatio,
		lights,
		userOrnaments
	});
	const out = await new GLTFExporter().parseAsync(scene, {
		binary,
		onlyVisible: true
	});
	scene.traverse((o) => {
		if (o.isMesh && o.userData.xtkOwned) o.geometry.dispose();
	});
	return out;
}
async function downloadGLB(tree, filename = "christmas-tree.glb", opts) {
	const buf = await exportGLB(tree, opts);
	const url = URL.createObjectURL(new Blob([buf], { type: "model/gltf-binary" }));
	Object.assign(document.createElement("a"), {
		href: url,
		download: filename
	}).click();
	setTimeout(() => URL.revokeObjectURL(url), 2e3);
	return buf.byteLength;
}
function buildExportScene(tree, { bake = true, needleRatio = 1, lights = false, userOrnaments = true } = {}) {
	tree.updateMatrixWorld(true);
	const inv = new THREE.Matrix4().copy(tree.matrixWorld).invert();
	const scene = new THREE.Scene();
	const out = new THREE.Group();
	out.name = "christmas-tree";
	scene.add(out);
	const rel = new THREE.Matrix4();
	const matCache = /* @__PURE__ */ new Map();
	tree.root.traverse((o) => {
		if (!o.visible) return;
		if (!userOrnaments && o.parent?.name === "ornament-layer") return;
		if (o.isLight) {
			if (!lights) return;
			const l = o.clone();
			rel.multiplyMatrices(inv, o.matrixWorld).decompose(l.position, l.quaternion, l.scale);
			l.intensity = o.intensity / 30;
			out.add(l);
			return;
		}
		if (!o.isMesh || o.isSprite) return;
		if (o.material?.visible === false || o.material?.colorWrite === false) return;
		let count = o.isInstancedMesh ? o.count : 1;
		if (o.name === "needles") count = Math.max(1, Math.floor(o.count * needleRatio));
		if (o.isInstancedMesh && count === 0) return;
		rel.multiplyMatrices(inv, o.matrixWorld);
		const mat = exportMaterial(o, matCache, bake);
		let mesh;
		if (o.isInstancedMesh && bake) mesh = new THREE.Mesh(bakeInstances(o, count, rel), mat);
		else if (o.isInstancedMesh) {
			mesh = new THREE.InstancedMesh(o.geometry, mat, count);
			for (let i = 0; i < count; i++) {
				o.getMatrixAt(i, _m);
				mesh.setMatrixAt(i, _m);
			}
			if (o.instanceColor) mesh.instanceColor = new THREE.InstancedBufferAttribute(o.instanceColor.array.slice(0, count * 3), 3);
			rel.decompose(mesh.position, mesh.quaternion, mesh.scale);
		} else {
			const g = o.geometry.clone().applyMatrix4(rel);
			mesh = new THREE.Mesh(g, mat);
			mesh.userData.xtkOwned = true;
		}
		if (mesh.geometry !== o.geometry) mesh.userData.xtkOwned = true;
		mesh.name = o.name || "mesh";
		out.add(mesh);
	});
	return scene;
}
var _m = new THREE.Matrix4();
var _n = new THREE.Matrix3();
var _w = new THREE.Matrix4();
var _v = new THREE.Vector3();
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
	g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
	if (nor) g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
	if (uv) g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
	if (col) g.setAttribute("color", new THREE.BufferAttribute(col, 3));
	if (index) g.setIndex(new THREE.BufferAttribute(index, 1));
	return g;
}
function exportMaterial(o, cache, bake) {
	const src = o.material;
	const baked = bake && o.isInstancedMesh && !!o.instanceColor;
	const key = `${src.uuid}|${baked}|${o.name}`;
	if (cache.has(key)) return cache.get(key);
	let mat;
	if (o.name === "bulbs") mat = new THREE.MeshBasicMaterial({
		color: "#ffffff",
		vertexColors: baked
	});
	else {
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
// src/viewer.js
var MOODS = {
	night: {
		top: "#0b1530",
		bottom: "#2a3a63",
		hemi: [
			"#9fb6e8",
			"#2a2233",
			.5
		],
		sun: ["#c8d6ff", 1.1],
		exposure: 1
	},
	evening: {
		top: "#1d1840",
		bottom: "#d77a5c",
		hemi: [
			"#ffd2b0",
			"#3a2a40",
			.7
		],
		sun: ["#ffd0a0", 1.6],
		exposure: 1
	},
	day: {
		top: "#7fb0e6",
		bottom: "#e8f0fa",
		hemi: [
			"#ffffff",
			"#8a8f99",
			1
		],
		sun: ["#fff4e0", 2.4],
		exposure: .9
	}
};
function gradientTexture(top, bottom) {
	if (typeof document === "undefined") return new THREE.Color(top);
	const c = document.createElement("canvas");
	c.width = 4;
	c.height = 256;
	const ctx = c.getContext("2d");
	const g = ctx.createLinearGradient(0, 0, 0, 256);
	g.addColorStop(0, top);
	g.addColorStop(1, bottom);
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, 4, 256);
	const t = new THREE.CanvasTexture(c);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
function createSnowfall(radius, height, count = 1500) {
	const pos = new Float32Array(count * 3);
	const speed = new Float32Array(count);
	for (let i = 0; i < count; i++) {
		pos[i * 3] = (Math.random() * 2 - 1) * radius;
		pos[i * 3 + 1] = Math.random() * height;
		pos[i * 3 + 2] = (Math.random() * 2 - 1) * radius;
		speed[i] = .5 + Math.random() * .7;
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
	const mat = new THREE.PointsMaterial({
		size: height * .012,
		map: glowTexture(),
		transparent: true,
		depthWrite: false,
		color: "#ffffff",
		opacity: .85
	});
	const pts = new THREE.Points(g, mat);
	pts.name = "snowfall";
	pts.frustumCulled = false;
	pts.userData.step = (dt, t) => {
		const fall = height * .08;
		for (let i = 0; i < count; i++) {
			let y = pos[i * 3 + 1] - dt * fall * speed[i];
			if (y < 0) y += height;
			pos[i * 3 + 1] = y;
			pos[i * 3] += Math.sin(t * .7 + i) * dt * .05 * radius * .05;
		}
		g.attributes.position.needsUpdate = true;
	};
	return pts;
}
function createViewer(container, options = {}) {
	const { background = "night", autoRotate = true, controls: useControls = true, ground = true, snowfall = true, shadows = true, pixelRatio = Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio : 1), renderer: externalRenderer = null, json = null, ...treeOptions } = options;
	const renderer = externalRenderer ?? new THREE.WebGLRenderer({
		antialias: true,
		alpha: background === "transparent",
		preserveDrawingBuffer: false,
		powerPreference: "high-performance"
	});
	renderer.setPixelRatio(pixelRatio);
	renderer.outputColorSpace = THREE.SRGBColorSpace;
	renderer.toneMapping = THREE.ACESFilmicToneMapping;
	renderer.shadowMap.enabled = shadows;
	renderer.shadowMap.type = THREE.PCFShadowMap;
	if (!externalRenderer) {
		renderer.domElement.style.display = "block";
		renderer.domElement.style.width = "100%";
		renderer.domElement.style.height = "100%";
		renderer.domElement.style.touchAction = "none";
		container.appendChild(renderer.domElement);
	}
	const scene = new THREE.Scene();
	const pmrem = new THREE.PMREMGenerator(renderer);
	const envRT = pmrem.fromScene(new RoomEnvironment(), .04);
	scene.environment = envRT.texture;
	scene.environmentIntensity = .35;
	const camera = new THREE.PerspectiveCamera(38, 1, .05, 500);
	const hemi = new THREE.HemisphereLight();
	const sun = new THREE.DirectionalLight();
	sun.castShadow = shadows;
	sun.shadow.mapSize.set(2048, 2048);
	sun.shadow.bias = -4e-4;
	sun.shadow.normalBias = .02;
	scene.add(hemi, sun, sun.target);
	let tree = null;
	let floor = null;
	let snow = null;
	let bgTex = null;
	function setMood(name) {
		const mood = MOODS[name] ?? MOODS.night;
		bgTex?.dispose?.();
		bgTex = null;
		if (name === "transparent") {
			scene.background = null;
			renderer.setClearColor(0, 0);
		} else if (MOODS[name]) {
			bgTex = gradientTexture(mood.top, mood.bottom);
			scene.background = bgTex;
		} else scene.background = new THREE.Color(name);
		hemi.color.set(mood.hemi[0]);
		hemi.groundColor.set(mood.hemi[1]);
		hemi.intensity = mood.hemi[2];
		sun.color.set(mood.sun[0]);
		sun.intensity = mood.sun[1];
		renderer.toneMappingExposure = mood.exposure;
	}
	function frame() {
		const H = tree.size;
		const fp = tree.footprint;
		const dist = H * 2.35;
		camera.position.set(dist * .55, H * .62, dist * .84);
		camera.near = H * .01;
		camera.far = H * 60;
		camera.updateProjectionMatrix();
		if (controls) {
			controls.target.set(0, H * .45, 0);
			controls.minDistance = H * .35;
			controls.maxDistance = H * 6;
			controls.update();
		} else camera.lookAt(0, H * .45, 0);
		sun.position.set(H * 1.2, H * 2.2, H * .9);
		const sc = sun.shadow.camera;
		const r = Math.max(fp.crownRadius, H * .4) * 1.6;
		sc.left = -r;
		sc.right = r;
		sc.top = r;
		sc.bottom = -r;
		sc.near = H * .1;
		sc.far = H * 6;
		sc.updateProjectionMatrix();
		if (floor) {
			scene.remove(floor);
			floor.geometry.dispose();
			floor.material.dispose();
			floor = null;
		}
		if (ground) {
			floor = new THREE.Mesh(new THREE.CircleGeometry(H * 6, 64), new THREE.MeshStandardMaterial({
				color: typeof ground === "string" ? ground : "#dfe7f2",
				roughness: .95
			}));
			floor.rotation.x = -Math.PI / 2;
			floor.receiveShadow = true;
			floor.name = "ground";
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
		controls.autoRotateSpeed = .6;
		controls.enablePan = false;
		controls.maxPolarAngle = Math.PI * .53;
		let idle = 0;
		controls.addEventListener("start", () => {
			controls.autoRotate = false;
			clearTimeout(idle);
		});
		controls.addEventListener("end", () => {
			clearTimeout(idle);
			if (api.autoRotate) idle = setTimeout(() => controls.autoRotate = true, 6e3);
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
	const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
	ro?.observe(container);
	let visible = true;
	const io = typeof IntersectionObserver !== "undefined" ? new IntersectionObserver((es) => {
		visible = es[0]?.isIntersecting ?? true;
	}) : null;
	io?.observe(container);
	const clock = new THREE.Timer();
	let raf = 0;
	let running = true;
	const hooks = /* @__PURE__ */ new Set();
	function loop() {
		raf = requestAnimationFrame(loop);
		clock.update();
		const dt = Math.min(.05, clock.getDelta());
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
		onFrame(fn) {
			hooks.add(fn);
			return () => hooks.delete(fn);
		},
		ndc(clientX, clientY) {
			const r = renderer.domElement.getBoundingClientRect();
			return new THREE.Vector2((clientX - r.left) / r.width * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
		},
		toBlob(type = "image/png") {
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
		}
	};
	setMood(background);
	resize();
	setTree(json ?? treeOptions);
	loop();
	return api;
}
// src/element.js
var TREE_ATTRS = [
	"preset",
	"seed",
	"size",
	"quality",
	"palette",
	"light-color",
	"lights",
	"ornaments",
	"presents",
	"topper",
	"base",
	"garland",
	"beads",
	"snow",
	"glow",
	"twinkle"
];
var VIEW_ATTRS = [
	"background",
	"auto-rotate",
	"camera-controls",
	"snowfall",
	"ground",
	"shadows"
];
var NUM = /* @__PURE__ */ new Set([
	"seed",
	"size",
	"lights",
	"ornaments",
	"presents",
	"snow",
	"glow",
	"twinkle"
]);
var BOOL_TREE = /* @__PURE__ */ new Set(["garland", "beads"]);
var LIVE = /* @__PURE__ */ new Set([
	"snow",
	"glow",
	"twinkle"
]);
var COLORS = [
	"#e23b3b",
	"#f2c14e",
	"#3fa4ff",
	"#36c27a",
	"#c46cff",
	"#ff8fc7",
	"#f4f4f4"
];
var groundAttr = (v) => v === null || v === "" ? true : v === "false" ? false : v;
var camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
var HTMLElementBase = typeof HTMLElement !== "undefined" ? HTMLElement : class {};
var XmasTreeElement = class extends HTMLElementBase {
	static get observedAttributes() {
		return [
			...TREE_ATTRS,
			...VIEW_ATTRS,
			"src",
			"decorate",
			"ornament-shape",
			"ornament-color"
		];
	}
	constructor() {
		super();
		this.viewer = null;
		this._json = null;
		const root = this.attachShadow({ mode: "open" });
		root.innerHTML = `<style>
      :host { display:block; position:relative; width:100%; height:420px; contain:content; }
      .stage { position:absolute; inset:0; }
      :host([decorate]) .stage { cursor:crosshair; }
    </style><div class="stage" part="stage"></div>`;
		this._stage = root.querySelector(".stage");
	}
	get tree() {
		return this.viewer?.tree ?? null;
	}
	set config(v) {
		this._json = v;
		if (this.viewer) this._rebuild();
	}
	get config() {
		return this.tree?.toJSON() ?? this._json;
	}
	toJSON() {
		return this.tree?.toJSON() ?? null;
	}
	toBlob(type) {
		return this.viewer?.toBlob(type);
	}
	exportGLB(opts) {
		return this.viewer?.exportGLB(opts);
	}
	downloadGLB(name, opts) {
		return this.viewer?.downloadGLB(name, opts);
	}
	async connectedCallback() {
		if (this.viewer) return;
		const src = this.getAttribute("src");
		if (src && !this._json) try {
			this._json = await (await fetch(src)).json();
		} catch (e) {
			console.warn("xmas-tree: src 를 읽지 못했습니다", e);
		}
		if (!this.isConnected || this.viewer) return;
		const has = (n) => this.hasAttribute(n) && this.getAttribute(n) !== "false";
		this.viewer = createViewer(this._stage, {
			background: this.getAttribute("background") || "night",
			autoRotate: has("auto-rotate"),
			controls: has("camera-controls"),
			snowfall: has("snowfall"),
			ground: groundAttr(this.getAttribute("ground")),
			shadows: this.getAttribute("shadows") !== "false",
			...this._treeOptions()
		});
		this._bindTree();
		this._bindPointer();
		this.dispatchEvent(new CustomEvent("load", { detail: { tree: this.tree } }));
	}
	disconnectedCallback() {
		this.viewer?.dispose();
		this.viewer = null;
	}
	attributeChangedCallback(name, old, value) {
		if (!this.viewer || old === value) return;
		if (LIVE.has(name)) {
			this.tree[name] = Number(value);
			return;
		}
		if (name === "background") return this.viewer.setBackground(value || "night");
		if (name === "auto-rotate" && this.viewer.controls) {
			this.viewer.autoRotate = value !== null;
			this.viewer.controls.autoRotate = value !== null;
			return;
		}
		if (TREE_ATTRS.includes(name)) {
			const o = this._treeOptions();
			this.tree.set(o);
			if (name === "size") this.viewer.frame();
			return;
		}
		if (name === "src") {
			this._json = null;
			this.disconnectedCallback();
			this.connectedCallback();
		}
	}
	_treeOptions() {
		const base = this._json ? { ...this._json } : {};
		const out = {
			...base,
			tree: { ...base.tree ?? {} },
			decor: { ...base.decor ?? {} }
		};
		for (const a of TREE_ATTRS) {
			if (!this.hasAttribute(a)) continue;
			let v = this.getAttribute(a);
			if (NUM.has(a)) v = Number(v);
			if (BOOL_TREE.has(a)) v = v !== "false";
			const k = camel(a);
			if (k === "seed") out.tree.seed = v;
			else if ([
				"palette",
				"lightColor",
				"lights",
				"ornaments",
				"presents",
				"topper",
				"base",
				"garland",
				"beads"
			].includes(k)) out.decor[k] = v;
			else out[k] = v;
		}
		return out;
	}
	_rebuild() {
		this.viewer.setTree(this._treeOptions());
		this._bindTree();
	}
	_bindTree() {
		const t = this.tree;
		const fwd = (type) => (e) => this.dispatchEvent(new CustomEvent(type, { detail: {
			ornament: e.ornament,
			tree: t
		} }));
		t.addEventListener("ornamentadd", fwd("ornamentadd"));
		t.addEventListener("ornamentremove", fwd("ornamentremove"));
	}
	_bindPointer() {
		const el = this.viewer.renderer.domElement;
		let down = null;
		el.addEventListener("pointerdown", (e) => down = [e.clientX, e.clientY]);
		el.addEventListener("pointermove", (e) => {
			if (!this.hasAttribute("decorate")) return;
			const spot = this.tree.surfacePoint(this.viewer.ndc(e.clientX, e.clientY), this.viewer.camera);
			this.tree.ornaments.preview(spot, this._shape(), this._color());
		});
		el.addEventListener("pointerleave", () => this.tree?.ornaments.preview(null));
		el.addEventListener("pointerup", (e) => {
			if (!this.hasAttribute("decorate") || !down) return;
			if (Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) return;
			const ndc = this.viewer.ndc(e.clientX, e.clientY);
			if (e.shiftKey) {
				const hit = this.tree.pickOrnament(ndc, this.viewer.camera);
				if (hit) this.tree.removeOrnament(hit.id);
				return;
			}
			const spot = this.tree.surfacePoint(ndc, this.viewer.camera);
			if (!spot) return;
			this.tree.addOrnament({
				shape: this._shape(),
				color: this._color(),
				h: spot.h,
				a: spot.a
			});
			this._next = null;
			this._nextShape = null;
		});
	}
	_shape() {
		const s = this.getAttribute("ornament-shape");
		if (ORNAMENT_SHAPES.includes(s)) return s;
		if (!this._nextShape) this._nextShape = ORNAMENT_SHAPES[Math.floor(Math.random() * ORNAMENT_SHAPES.length)];
		return this._nextShape;
	}
	_color() {
		if (!this._next) this._next = COLORS[Math.floor(Math.random() * COLORS.length)];
		return this.getAttribute("ornament-color") || this._next;
	}
};
function defineXmasTree(tag = "xmas-tree") {
	if (typeof customElements === "undefined" || customElements.get(tag)) return;
	customElements.define(tag, class extends XmasTreeElement {});
}
export { createBulbMaterial as C, addSnow as S, mulberry32 as T, buildDecorations as _, downloadGLB as a, TREE_DEFAULTS as b, FORMAT as c, PRESETS as d, QUALITY as f, PALETTES as g, LIGHT_COLORS as h, buildExportScene as i, FORMAT_VERSION as l, DECOR_DEFAULTS as m, defineXmasTree as n, exportGLB as o, createOrnamentLayer as p, createViewer as r, ChristmasTree as s, XmasTreeElement as t, resolve as u, ORNAMENT_SHAPES as v, createUniforms as w, buildTree as x, ornamentGeometry as y };

//# sourceMappingURL=element-C1i-Mtto.js.map