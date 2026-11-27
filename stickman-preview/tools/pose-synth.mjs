// Synthetic recordings for tools/follow-bench.mjs: the app's own scripted actions (src/core/actions.js) turned into
// MediaPipe-shaped results, with landmark noise like the real model's (small, frame-to-frame correlated, depth much
// noisier) and its two kinds of glitch: a single joint thrown 15–35 cm off for a frame or two, and the left / right
// legs swapped for a couple of frames. Each file starts and ends with a few seconds of standing still (jitter), and a
// clean copy (same timing, no noise, no glitches) is written next to it as the truth (follow-bench --truth).
//
// Usage (in stickman-preview/): node tools/pose-synth.mjs <outDir> [--fps 30] [--seed 1] [--glitch 1] [--noise 1]   (--glitch scales how often glitches happen, 0 = noise only; --noise scales the noise)
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ACT } from '../src/core/actions.js';
import { solve, ground, lerpQ } from '../src/core/skeleton.js';
import { sub, add, mul, V } from '../src/core/math.js';

const MP = { shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16, hipL: 23, hipR: 24, knL: 25, knR: 26, anL: 27, anR: 28, heelL: 29, heelR: 30, toeL: 31, toeR: 32 };
const SWAP = [[23, 24], [25, 26], [27, 28], [29, 30], [31, 32]];
const GLITCH_J = [13, 14, 15, 16, 25, 26, 27, 28];

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** MediaPipe world landmarks (x right in the image, y down, z away; hip-centred) of one scripted pose */
function worldOf(q) {
  const P = solve(q).P, c = mul(add(P.hipL, P.hipR), 0.5);
  const w = Array.from({ length: 33 }, () => null), put = (i, p) => { const q = sub(p, c); w[i] = { x: q.x, y: -q.y, z: -q.z }; };
  for (const k in MP) put(MP[k], P[k]);
  const hd = P.head; put(0, add(hd, V(0, -0.02, 0.17))); put(7, add(hd, V(0.08, 0, 0))); put(8, add(hd, V(-0.08, 0, 0)));
  for (let i = 0; i < 33; i++) if (!w[i]) w[i] = { ...w[0] };
  return w;
}

const BLEND = 0.5;
/** script: [action, seconds] */
const SCRIPTS = {
  squat: [['idle', 3], ['squat', 12], ['idle', 3]],
  curl: [['idle', 3], ['curl', 10.4], ['idle', 3]],
  press: [['idle', 3], ['press', 11.2], ['idle', 3]],
  lateral: [['idle', 3], ['lateral', 10.4], ['idle', 3]],
  lunge: [['idle', 3], ['lunge', 11.2], ['idle', 3]]
};

export function synth(name, fps, seed, glitches = 1, noiseK = 1, aspect = 9 / 16, H = 2.3) {
  const R = rng(seed), g = () => { let u = 0; for (let i = 0; i < 6; i++) u += R(); return (u - 3) / Math.sqrt(0.5); };
  const seq = SCRIPTS[name], total = seq.reduce((a, s) => a + s[1], 0), dt = 1 / fps;
  const noise = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, ix: 0, iy: 0 }));
  const rho = 0.55, k = Math.sqrt(1 - rho * rho);
  const clean = [], noisy = [];
  let glitch = null, swap = 0;
  ground.sm = null;
  for (let t = 0; t < total; t += dt) {
    let acc = 0, si = 0;
    while (si < seq.length - 1 && t >= acc + seq[si][1]) acc += seq[si++][1];
    const qOf = (j, lt) => ACT[seq[j][0]].pose(lt, ACT[seq[j][0]].P), lt = t - acc;
    // 0.5 s blend from the previous segment, like a person easing into the next move
    const q = si > 0 && lt < BLEND ? lerpQ(qOf(si - 1, seq[si - 1][1] + lt), qOf(si, lt), lt / BLEND) : qOf(si, lt);
    const w = worldOf(q);
    const img = w.map(p => ({ x: (0.5 * aspect + p.x / H) / aspect, y: 0.55 + p.y / H, z: p.z / H }));
    const flat = (arr, vis) => arr.flatMap((p, i) => [p.x, p.y, p.z, vis ? vis[i] : 0.95]);
    clean.push({ t: t * 1000, wl: flat(w), lm: flat(img) });
    // noise: AR(1), world x / y 0.6 cm, z 1.5 cm, image 0.15 % of the height; wrists and ankles a bit noisier
    const wn = [], im = [], vis = [];
    for (let i = 0; i < 33; i++) {
      const n = noise[i], m = ([15, 16, 27, 28, 31, 32].includes(i) ? 1.5 : 1) * noiseK;
      n.x = rho * n.x + k * 0.006 * m * g(); n.y = rho * n.y + k * 0.006 * m * g(); n.z = rho * n.z + k * 0.015 * m * g();
      n.ix = rho * n.ix + k * 0.0015 * m * g(); n.iy = rho * n.iy + k * 0.0015 * m * g();
      wn.push({ x: w[i].x + n.x, y: w[i].y + n.y, z: w[i].z + n.z }); im.push({ x: img[i].x + n.ix / aspect, y: img[i].y + n.iy, z: img[i].z });
      vis.push(0.9 + 0.08 * R());
    }
    if (!glitch && R() < 0.012 * glitches) {                    // one joint thrown off for 1–2 frames
      const ang = R() * Math.PI * 2, d = 0.15 + 0.2 * R();
      glitch = { i: GLITCH_J[Math.floor(R() * GLITCH_J.length)], n: 1 + (R() < 0.4 ? 1 : 0), dx: Math.cos(ang) * d, dy: Math.sin(ang) * d };
    }
    if (glitch) {
      const { i, dx, dy } = glitch;
      wn[i] = { x: wn[i].x + dx, y: wn[i].y + dy, z: wn[i].z + 0.1 * g() }; im[i] = { x: im[i].x + dx / H / aspect, y: im[i].y + dy / H, z: im[i].z };
      vis[i] = 0.6 + 0.3 * R();
      if (--glitch.n <= 0) glitch = null;
    }
    if (!swap && R() < 0.004 * glitches) swap = 2 + Math.floor(R() * 2);   // legs swapped
    if (swap) { for (const [a, b] of SWAP) { [wn[a], wn[b]] = [wn[b], wn[a]]; [im[a], im[b]] = [im[b], im[a]]; } swap--; }
    noisy.push({ t: t * 1000, wl: flat(wn, vis), lm: flat(im, vis) });
  }
  const h = 1080, wpx = Math.round(h * aspect);
  return { noisy: { name: `${name} (synthetic)`, w: wpx, h, frames: noisy }, clean: { name: `${name} (clean)`, w: wpx, h, frames: clean } };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const a = process.argv.slice(2), out = a[0];
  if (!out) { console.error('usage: node tools/pose-synth.mjs <outDir> [--fps 30] [--seed 1] [--glitch 1] [--noise 1]'); process.exit(1); }
  const opt = (n, d) => { const i = a.indexOf('--' + n); return i >= 0 ? Number(a[i + 1]) : d; };
  const fps = opt('fps', 30), seed = opt('seed', 1);
  mkdirSync(out, { recursive: true });
  Object.keys(SCRIPTS).forEach((name, i) => {
    const r = synth(name, fps, seed * 100 + i, opt('glitch', 1), opt('noise', 1));
    writeFileSync(join(out, `${name}.json`), JSON.stringify(r.noisy));
    writeFileSync(join(out, `${name}.clean.json`), JSON.stringify(r.clean));
  });
  console.log(`wrote ${Object.keys(SCRIPTS).length} recordings (+ clean truth) to ${out}`);
}
