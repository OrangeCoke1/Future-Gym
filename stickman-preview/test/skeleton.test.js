// core/skeleton.js + core/actions.js: every scripted pose solves to finite joints and keeps the figure's bone lengths.
import { describe, test, expect } from 'vitest';
import { B, solve } from '../src/core/skeleton.js';
import { ACT } from '../src/core/actions.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const BONES = [['hip', 'kn', B.thigh], ['kn', 'an', B.shin], ['sh', 'el', B.ua], ['el', 'wr', B.fa]];

describe.each(Object.keys(ACT))('%s', k => {
  const A = ACT[k];
  test('solves to finite joints with constant bone lengths over a rep', () => {
    for (let i = 0; i <= 12; i++) {
      const { P, D } = solve(A.pose(i / 12 * A.P, A.P));
      for (const [name, p] of Object.entries(P)) for (const c of ['x', 'y', 'z']) expect(Number.isFinite(p[c]), name + '.' + c).toBe(true);
      for (const f of Object.values(D)) expect(Math.hypot(f.x, f.y, f.z)).toBeCloseTo(1, 5);
      for (const n of ['L', 'R']) for (const [a, b, l] of BONES) expect(dist(P[a + n], P[b + n]), a + n + '→' + b + n).toBeCloseTo(l, 5);
    }
  });
});
