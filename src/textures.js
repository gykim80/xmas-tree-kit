import * as THREE from 'three';
import { mulberry32 } from './core/rng.js';

// 캔버스로 그린 텍스처 모음. 외부 이미지 없이 동작하고, DOM 이 없는 환경(Node)에서는 null 을 돌려준다
const HAS_DOM = typeof document !== 'undefined';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, { srgb = true, repeat = false } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

const cache = new Map();
function cached(key, fn) {
  if (!HAS_DOM) return null;
  if (!cache.has(key)) cache.set(key, fn());
  return cache.get(key);
}

// 전나무 잔가지 한 줄기: 가운데 줄기와 앞쪽으로 비스듬히 난 바늘잎
export function needleTexture() {
  return cached('needle', () => {
    const [c, ctx] = makeCanvas(512, 256);
    const rand = mulberry32(42);
    const mid = 128;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3b2c1a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(4, mid);
    ctx.lineTo(496, mid);
    ctx.stroke();
    for (let i = 0; i < 340; i++) {
      const x = 8 + rand() * 470;
      const t = x / 512;
      const side = i % 2 ? 1 : -1;
      const len = (78 + rand() * 38) * (1 - t * 0.5);
      const ang = 0.6 + rand() * 0.55;
      const ex = x + Math.cos(ang) * len;
      const ey = mid + side * Math.sin(ang) * len;
      const g = ctx.createLinearGradient(x, mid, ex, ey);
      const light = rand();
      g.addColorStop(0, '#0f2d17');
      g.addColorStop(0.55, light > 0.5 ? '#245a2b' : '#1d4d27');
      g.addColorStop(1, light > 0.7 ? '#4f8b46' : '#336f37');
      ctx.strokeStyle = g;
      ctx.lineWidth = 3.2 + rand() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, mid + side * 2);
      ctx.quadraticCurveTo(x + Math.cos(ang) * len * 0.5, mid + side * Math.sin(ang) * len * 0.42, ex, ey);
      ctx.stroke();
    }
    const tex = toTexture(c);
    tex.generateMipmaps = true;
    return tex;
  });
}

// 세로 결이 있는 나무껍질
export function barkTexture() {
  return cached('bark', () => {
    const [c, ctx] = makeCanvas(256, 512);
    const rand = mulberry32(7);
    ctx.fillStyle = '#3a2717';
    ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 420; i++) {
      const x = rand() * 256;
      const y = rand() * 512;
      const l = 30 + rand() * 120;
      const v = 30 + rand() * 50;
      ctx.strokeStyle = `rgba(${v + 30},${v + 10},${v - 10},${0.25 + rand() * 0.5})`;
      ctx.lineWidth = 1 + rand() * 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + rand() * 8 - 4, y + l * 0.3, x + rand() * 8 - 4, y + l * 0.6, x + rand() * 6 - 3, y + l);
      ctx.stroke();
    }
    return toTexture(c, { repeat: true });
  });
}

// 부드러운 원형 빛 번짐
export function glowTexture() {
  return cached('glow', () => {
    const [c, ctx] = makeCanvas(128, 128);
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,240,200,0.55)');
    g.addColorStop(0.6, 'rgba(255,220,150,0.12)');
    g.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return toTexture(c);
  });
}

// 선물 포장지 (줄무늬·물방울)
export function wrapTexture(base, accent, style) {
  return cached(`wrap-${base}-${accent}-${style}`, () => {
    const [c, ctx] = makeCanvas(128, 128);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = accent;
    if (style === 0) {
      for (let i = -128; i < 256; i += 24) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 10, 0);
        ctx.lineTo(i + 138, 128);
        ctx.lineTo(i + 128, 128);
        ctx.fill();
      }
    } else if (style === 1) {
      for (let y = 8; y < 128; y += 22) {
        for (let x = (y / 22) % 2 ? 8 : 19; x < 128; x += 22) {
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else {
      for (let y = 0; y < 128; y += 32) ctx.fillRect(0, y, 128, 6);
      for (let x = 0; x < 128; x += 32) ctx.fillRect(x, 0, 6, 128);
    }
    return toTexture(c, { repeat: true });
  });
}

// 바늘잎 알파를 높이로 보고 노멀맵을 만든다 (잎마다 입체감)
export function needleNormalTexture() {
  return cached('needleNormal', () => {
    const src = needleTexture().image;
    const w = src.width;
    const h = src.height;
    const sctx = src.getContext('2d');
    const a = sctx.getImageData(0, 0, w, h).data;
    const [c, ctx] = makeCanvas(w, h);
    const out = ctx.createImageData(w, h);
    const H = (x, y) => a[((Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) * 4) + 3] / 255;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (H(x + 1, y) - H(x - 1, y)) * 2.5;
        const dy = (H(x, y + 1) - H(x, y - 1)) * 2.5;
        const l = Math.hypot(dx, dy, 1);
        const i = (y * w + x) * 4;
        out.data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
        out.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255;
        out.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
        out.data[i + 3] = 255;
      }
    }
    ctx.putImageData(out, 0, 0);
    return toTexture(c, { srgb: false });
  });
}

// 화단 테두리 돌
export function stoneTexture() {
  return cached('stone', () => {
    const [c, ctx] = makeCanvas(256, 128);
    const rand = mulberry32(5);
    ctx.fillStyle = '#5d5953';
    ctx.fillRect(0, 0, 256, 128);
    for (let r = 0; r < 4; r++) {
      const off = (r % 2) * 24;
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
