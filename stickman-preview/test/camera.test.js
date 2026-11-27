// pose/camera.js: the glitch guard and the prediction gates, on a synthetic standing person (tools/pose-synth.mjs).
import { describe, test, expect } from 'vitest';
import { createCamPose, camIngest, camPredict } from '../src/pose/camera.js';
import { synth } from '../tools/pose-synth.mjs';
import { len, sub } from '../src/core/math.js';

const unflat = a => { const o = []; for (let i = 0; i < a.length; i += 4) o.push({ x: a[i], y: a[i + 1], z: a[i + 2], visibility: a[i + 3] }); return o; };
const resOf = f => ({ landmarks: [unflat(f.lm)], worldLandmarks: [unflat(f.wl)] });
const clean = synth('curl', 30, 3, 0, 0).clean;           // still for the first 3 s, then curls
const still = clean.frames.filter(f => f.t < 2900);

/** a camera pose fed `frames`; edit(i, res) may change frame i first */
function run(frames, guard, edit = () => {}) {
  const cam = createCamPose(); cam.aspect = clean.w / clean.h; cam.tune.guard = guard;
  frames.forEach((f, i) => { const r = resOf(f); edit(i, r); camIngest(cam, r, f.t, false); });
  return cam;
}

describe('glitch guard', () => {
  const N = 40, kick = (i, r) => {                          // frame N: the left wrist thrown 30 cm sideways
    if (i !== N) return;
    r.worldLandmarks[0][15].x += 0.3; r.landmarks[0][15].x += 0.3 / 2.3 / (9 / 16);
  };
  test('a one-frame jump of a joint is held', () => {
    const before = run(still.slice(0, N), true).J.wrL;
    expect(len(sub(run(still.slice(0, N + 1), true, kick).J.wrL, before))).toBeLessThan(0.01);
    expect(len(sub(run(still.slice(0, N + 1), false, kick).J.wrL, before))).toBeGreaterThan(0.03);
  });
  test('a joint that really moved is taken after a couple of frames', () => {
    const moved = (i, r) => { if (i >= N) { r.worldLandmarks[0][15].x += 0.3; r.landmarks[0][15].x += 0.3 / 2.3 / (9 / 16); } };
    const c = run(still.slice(0, N + 30), true, moved), ref = run(still.slice(0, N + 30), false, moved);
    expect(len(sub(c.J.wrL, ref.J.wrL))).toBeLessThan(0.03);
  });
  test('legs swapped left / right for a frame are swapped back', () => {
    const swap = (i, r) => {
      if (i !== N) return;
      for (const L of [r.worldLandmarks[0], r.landmarks[0]]) for (const [a, b] of [[23, 24], [25, 26], [27, 28], [29, 30], [31, 32]]) [L[a], L[b]] = [L[b], L[a]];
    };
    const before = run(still.slice(0, N), true).J;
    const after = run(still.slice(0, N + 1), true, swap).J;
    for (const k of ['knL', 'knR', 'anL', 'anR']) expect(len(sub(after[k], before[k]))).toBeLessThan(0.01);
  });
});

describe('prediction', () => {
  test('a person holding still is not extrapolated along the noise', () => {
    const noisy = synth('curl', 30, 5, 0, 1).noisy.frames.filter(f => f.t < 2900);
    const cam = createCamPose(); cam.aspect = clean.w / clean.h;
    let worst = 0, sum = 0, n = 0;
    noisy.forEach(f => {
      camIngest(cam, resOf(f), f.t, false);
      if (f.t < 1000) return;
      const P = camPredict(cam, f.t + 30, 0.08);
      for (const k in cam.J) { const d = len(sub(P[k], cam.J[k])); worst = Math.max(worst, d); sum += d; n++; }
    });
    expect(sum / n).toBeLessThan(0.002);                      // almost never: under 2 mm on average
    expect(worst).toBeLessThan(0.05);
  });
  test('a steady move is carried forward', () => {
    const cam = run(clean.frames.filter(f => f.t < 4500), true);    // halfway up the second curl
    const P = camPredict(cam, 4500, 0.08);
    expect(len(sub(P.wrL, cam.J.wrL))).toBeGreaterThan(0.02);
  });
});
