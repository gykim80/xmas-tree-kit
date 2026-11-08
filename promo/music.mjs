// Synthesizes the promo soundtrack: 120 BPM, 68 beats (34 s), 44.1 kHz stereo WAV.
// Intro with a noise riser, then the "Jingle Bells" chorus (public domain) on bells from beat 4,
// kick on every beat, clap on 2 and 4, hats, sleigh-bell shaker, offbeat chord stabs and a
// sub-boom on every scene change.
// node promo/music.mjs [out.wav]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const BPM = 120;
export const BEATS = 68;
export const CUTS = [4, 10, 22, 30, 38, 46, 58]; // scene changes (beats), keep in sync with SECTIONS in main.js
const SR = 44100;
const BEAT = 60 / BPM;
const TAIL = 2;
const N = Math.ceil((BEATS * BEAT + TAIL) * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

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
    if (s0 + i < 0) continue;
    const v = fn(i / SR, i / n);
    L[s0 + i] += v * gl;
    R[s0 + i] += v * gr;
  }
}

const kick = (t0, g = 1) =>
  add(t0, 0.5, g, 0, (t) => {
    const ph = 2 * Math.PI * (48 * t + (130 / 30) * (1 - Math.exp(-t * 30)));
    return Math.sin(ph) * Math.exp(-t * 6.5) + (t < 0.004 ? noise() * 0.35 : 0);
  });

function filteredNoise(t0, dur, g, pan, hp, decay, attack = 0) {
  let lp = 0;
  let prev = 0;
  add(t0, dur, g, pan, (t, u) => {
    const x = noise();
    const y = hp ? x - prev + 0.92 * lp : 0.6 * lp + 0.4 * x;
    prev = x;
    lp = y;
    return y * (attack ? Math.pow(u, attack) : Math.exp(-t * decay));
  });
}
const hat = (t0, g = 0.2, pan = 0.25) => filteredNoise(t0, 0.06, g, pan, true, 70);
const openHat = (t0, g = 0.14) => filteredNoise(t0, 0.25, g, -0.2, true, 14);
const shaker = (t0, g = 0.07) => filteredNoise(t0, 0.05, g, -0.4, true, 90);
const clap = (t0, g = 0.5) => {
  for (const d of [0, 0.011, 0.022]) filteredNoise(t0 + d, 0.2, g * 0.6, 0, true, 24);
};
// rising noise into a drop
const riser = (t0, dur, g = 0.35) => filteredNoise(t0, dur, g, 0, true, 0, 2.2);
// sub-boom on scene changes: falling sine plus a soft noise hit
const boom = (t0, g = 0.75) => {
  add(t0, 1.2, g, 0, (t) => Math.sin(2 * Math.PI * (38 * t + (90 / 6) * (1 - Math.exp(-t * 6)))) * Math.exp(-t * 2.6));
  filteredNoise(t0, 0.6, 0.18, 0, false, 6);
};
const bass = (t0, m, dur, g = 0.3) =>
  add(t0, dur, g, 0, (t) => {
    const f = midi(m);
    const env = Math.min(1, t * 200) * Math.exp(-t * 3);
    return (Math.sin(2 * Math.PI * f * t) + 0.4 * Math.sin(4 * Math.PI * f * t)) * env;
  });
const bell = (t0, m, g = 0.16, pan = 0, ring = 3.2) =>
  add(t0, 1.8, g, pan, (t) => {
    const f = midi(m);
    const env = Math.min(1, t * 400) * Math.exp(-t * ring);
    return (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 6) + 0.25 * Math.sin(2 * Math.PI * f * 5.4 * t) * Math.exp(-t * 9)) * env;
  });
// short saw-ish chord stab
const stab = (t0, notes, g = 0.05) => {
  for (const [k, m] of notes.entries())
    add(t0, 0.22, g, k % 2 ? 0.35 : -0.35, (t) => {
      const f = midi(m);
      let v = 0;
      for (let h = 1; h <= 6; h++) v += Math.sin(2 * Math.PI * f * h * t) / h;
      return v * Math.exp(-t * 16);
    });
};

// Jingle Bells chorus in C, [midi, beats]. 16 bars of 4 beats
const E = 76, F = 77, G = 79, C = 72, D = 74, Ch = 84;
const HALF = [
  [E, 1], [E, 1], [E, 2],
  [E, 1], [E, 1], [E, 2],
  [E, 1], [G, 1], [C, 1.5], [D, 0.5],
  [E, 4],
  [F, 1], [F, 1], [F, 1.5], [F, 0.5],
  [F, 1], [E, 1], [E, 1], [E, 0.5], [E, 0.5],
];
const MELODY = [
  ...HALF, [E, 1], [D, 1], [D, 1], [E, 1], [D, 2], [G, 2],
  ...HALF, [G, 1], [G, 1], [F, 1], [D, 1], [C, 4],
];
// root and triad per bar
const BARS = ['C', 'C', 'C', 'C', 'F', 'C', 'D', 'G', 'C', 'C', 'C', 'C', 'F', 'C', 'G', 'C'];
const CHORD = { C: [48, 60, 64, 67], F: [53, 60, 65, 69], G: [55, 59, 62, 67], D: [50, 60, 62, 66] };

const START = 4;
// intro: the first phrase hinted on soft bells, hats and a riser into the drop
for (let b = 0; b < START; b++) {
  hat(b * BEAT + BEAT * 0.5, 0.1);
  bell(b * BEAT, CHORD.C[1 + (b % 3)] + 12, 0.08, b % 2 ? 0.4 : -0.4);
}
riser(0.4, START * BEAT - 0.4);

let tm = START;
for (const [m, len] of MELODY) {
  bell(tm * BEAT, m, 0.2, 0.1);
  bell(tm * BEAT, m - 12, 0.08, -0.2, 4);
  tm += len;
}

for (let b = START; b < BEATS; b++) {
  const t = b * BEAT;
  const bar = Math.floor((b - START) / 4);
  const ch = CHORD[BARS[Math.min(bar, BARS.length - 1)]];
  const end = b >= 64;
  if (end) continue; // the last bar rings out on the final chord
  kick(t, 0.95);
  if (b % 2 === 1) clap(t);
  hat(t + BEAT * 0.5);
  if (b % 4 === 3) openHat(t + BEAT * 0.5);
  for (let s = 0; s < 4; s++) shaker(t + (s * BEAT) / 4);
  bass(t, ch[0] - 12, BEAT * 0.45);
  bass(t + BEAT * 0.5, ch[0], BEAT * 0.4, 0.18);
  stab(t + BEAT * 0.5, ch.slice(1).map((m) => m + 12));
}
for (const c of CUTS) {
  boom(c * BEAT);
  if (c > START) riser(c * BEAT - BEAT * 1.5, BEAT * 1.5, 0.16);
}
// final hit and ring-out
kick(64 * BEAT, 1.1);
boom(64 * BEAT, 0.9);
for (const m of CHORD.C) bell(64 * BEAT, m + 24, 0.1, 0, 1.2);
bell(64 * BEAT, Ch, 0.14, 0, 1.0);

// soft clip and normalize
let peak = 0;
for (let i = 0; i < N; i++) {
  L[i] = Math.tanh(L[i] * 0.85);
  R[i] = Math.tanh(R[i] * 0.85);
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
