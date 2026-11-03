// pose/fit.js (the camera team's rules, plus the local lenient squat): synthetic MediaPipe results built from our own
// skeleton, 30 frames a second. Pins the current counting: strict = deep squats only, lenient = shallow ones too.
// This guards strict mode against local edits; it cannot prove it still equals the camera team's upstream code.
import { describe, test, expect } from 'vitest';
import { createFit } from '../src/pose/fit.js';
import { solve, lerpQ } from '../src/core/skeleton.js';
import { ACT } from '../src/core/actions.js';

const SQ = ACT.squat, STAND = SQ.pose(0, SQ.P), BOTTOM = SQ.pose(0.43 * SQ.P, SQ.P);
// MediaPipe pose landmark index → our joint (0 nose … 32 right foot index)
const MAP = ['head', 'head', 'head', 'head', 'head', 'head', 'head', 'head', 'head', 'head', 'head',
  'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'handL', 'handR', 'handL', 'handR', 'handL', 'handR',
  'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR', 'heelL', 'heelR', 'toeL', 'toeR'];

// legs scaled about each hip (similar triangles keep every angle) so a standing person's hip–knee height is ~0.79 torso
// lengths as in real people; the figure's own proportions stand at 0.69, under the strict rule's 0.7 for "up"
const LEG = 1.15, LEG_PARTS = new Set(['kn', 'an', 'heel', 'toe']);
const legScaled = (P, k) => {
  const n = k.slice(-1);
  if (!LEG_PARTS.has(k.slice(0, -1))) return P[k];
  const h = P['hip' + n], p = P[k];
  return { x: h.x + (p.x - h.x) * LEG, y: h.y + (p.y - h.y) * LEG, z: h.z + (p.z - h.z) * LEG };
};

/** one frame: squat depth 0 (standing) … 1 (the demo's bottom) → a MediaPipe-shaped result */
function frame(depth) {
  const { P } = solve(lerpQ(STAND, BOTTOM, depth));
  const pts = MAP.map(k => legScaled(P, k));
  // world landmarks: metres-ish, y pointing down as in MediaPipe; image landmarks: inside the picture, fully visible
  return {
    worldLandmarks: [pts.map(p => ({ x: p.x, y: -p.y, z: -p.z, visibility: 1 }))],
    landmarks: [pts.map(p => ({ x: 0.5 + p.x * 0.3, y: 0.5 - p.y * 0.3, z: 0, visibility: 1 }))]
  };
}

/** stand 3 s, then `reps` reps of 2.5 s down to `depth`, then stand 1 s; returns the counted reps */
function count({ depth, reps = 4, lenient }) {
  const fit = createFit({ lenient });
  let n = 0, t = 0;
  const feed = d => { for (const e of fit.process(frame(d), t)) if (e.type === 'action_start' || e.type === 'rep') n = e.count; t += 1000 / 30; };
  for (let i = 0; i < 90; i++) feed(0);
  for (let r = 0; r < reps; r++) for (let i = 0; i < 75; i++) feed(depth * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / 75)));
  for (let i = 0; i < 30; i++) feed(0);
  return n;
}

describe('squat counting', () => {
  test('standing counts nothing', () => {
    expect(count({ depth: 0, lenient: false })).toBe(0);
    expect(count({ depth: 0, lenient: true })).toBe(0);
  });
  test('deep squats count in both modes', () => {
    expect(count({ depth: 1, lenient: false })).toBe(4);
    expect(count({ depth: 1, lenient: true })).toBe(4);
  });
  test('shallow squats count only in lenient mode', () => {
    expect(count({ depth: 0.35, lenient: false })).toBe(0);
    expect(count({ depth: 0.35, lenient: true })).toBe(4);
  });
});
