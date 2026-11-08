// Synthesizes the promo soundtrack: 120 BPM, 48 beats (24 s), 44.1 kHz stereo WAV.
// Kick on every beat, clap on 2 and 4, closed hats on 8ths, sleigh-bell shaker on 16ths,
// bass on the root and a bell arpeggio over C – Am – F – G.
// node promo/music.mjs [out.wav]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const BPM = 120;
export const BEATS = 48;
const SR = 44100;
const BEAT = 60 / BPM;
const TAIL = 1.5; // let the last bell ring
const N = Math.ceil((BEATS * BEAT + TAIL) * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

// deterministic noise
let seed = 1225;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};
const noise = () => rnd() * 2 - 1;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

function add(t0, dur, gain, pan, fn) {
  const s0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n && s0 + i < N; i++) {
    const v = fn(i / SR);
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

const kick = (t0, g = 1) =>
  add(t0, 0.45, g, 0, (t) => {
    const f = 45 + 110 * Math.exp(-t * 28);
    const ph = 2 * Math.PI * (45 * t + (110 / 28) * (1 - Math.exp(-t * 28)));
    return Math.sin(ph) * Math.exp(-t * 7) + (t < 0.004 ? noise() * 0.3 : 0) + 0 * f;
  });

// one-pole filters over noise
function filteredNoise(t0, dur, g, pan, hp, decay) {
  let lp = 0;
  let prev = 0;
  add(t0, dur, g, pan, (t) => {
    const x = noise();
    const y = hp ? x - prev + 0.92 * lp : 0.6 * lp + 0.4 * x;
    prev = x;
    lp = y;
    return y * Math.exp(-t * decay);
  });
}
const hat = (t0, g = 0.22, pan = 0.25) => filteredNoise(t0, 0.06, g, pan, true, 70);
const shaker = (t0, g = 0.08) => filteredNoise(t0, 0.05, g, -0.4, true, 90);
const clap = (t0, g = 0.5) => {
  for (const d of [0, 0.011, 0.022]) filteredNoise(t0 + d, 0.18, g * 0.6, 0, true, 26);
};
const bass = (t0, m, dur, g = 0.32) =>
  add(t0, dur, g, 0, (t) => {
    const f = midi(m);
    const env = Math.min(1, t * 200) * Math.exp(-t * 3.2);
    return (Math.sin(2 * Math.PI * f * t) + 0.35 * Math.sin(4 * Math.PI * f * t)) * env;
  });
const bell = (t0, m, g = 0.16, pan = 0) =>
  add(t0, 1.4, g, pan, (t) => {
    const f = midi(m);
    const env = Math.min(1, t * 400) * Math.exp(-t * 3.5);
    return (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 6) + 0.25 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 9)) * env;
  });

// C – Am – F – G, one chord per bar (4 beats)
const CHORDS = [
  [60, 64, 67, 72],
  [57, 60, 64, 69],
  [53, 57, 60, 65],
  [55, 59, 62, 67],
];
const ARP = [0, 1, 2, 3, 2, 1, 2, 3]; // per 8th note in a bar

for (let b = 0; b < BEATS; b++) {
  const t = b * BEAT;
  const bar = Math.floor(b / 4);
  const chord = CHORDS[bar % 4];
  const intro = b < 4;
  const outro = b >= BEATS - 4;
  // bells every 8th, an octave up in the hook sections
  for (let e = 0; e < 2; e++) {
    const idx = ARP[(b % 4) * 2 + e];
    const up = b >= 20 && b < 36 ? 12 : 0;
    bell(t + e * BEAT * 0.5, chord[idx] + 12 + up, intro ? 0.12 : 0.14, e ? 0.3 : -0.3);
  }
  if (intro) {
    // build-up: hats only, then a kick on the downbeat of the drop
    hat(t + BEAT * 0.5, 0.12);
    continue;
  }
  kick(t, outro && b === BEATS - 1 ? 1.1 : 0.95);
  if (b % 2 === 1) clap(t);
  hat(t + BEAT * 0.5);
  for (let s = 0; s < 4; s++) shaker(t + (s * BEAT) / 4);
  bass(t, chord[0] - 24, BEAT * 0.9);
}
// final ring-out chord
for (const m of CHORDS[0]) bell(BEATS * BEAT, m + 12, 0.12);
kick(BEATS * BEAT, 1);

// soft clip and normalize
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 0.9);
  R[i] = Math.tanh(R[i] * 0.9);
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const gain = 0.89 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write('WAVEfmt ', 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(L[i] * gain * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(R[i] * gain * 32767), 46 + i * 4);
}
const out = process.argv[2] ?? 'promo/out/music.wav';
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, buf);
console.log(`wrote ${out} (${(N / SR).toFixed(2)} s)`);
