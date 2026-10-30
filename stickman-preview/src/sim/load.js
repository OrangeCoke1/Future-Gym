// Joint load in multiples of body weight, from how bent the joints are plus an impact term for bouncy actions (simulated).
import { sub, dot, nrm, clamp, UP } from '../core/math.js';
import { angle3 } from '../core/skeleton.js';

export const IMPACT = { walk: 0.4, jog: 1.6, high: 1.8, jacks: 1.5 };

/** @typedef {{ knee: number, hip: number, spine: number }} LoadState */
/** @returns {LoadState} */
export const createLoad = () => ({ knee: 0.5, hip: 0.5, spine: 0.6 });

/**
 * one frame; values are smoothed (τ 0.25 s) so they can be drawn every frame
 * @param {LoadState} L @param {import('../core/skeleton.js').Joints} P
 * @param {{ action: string, run: boolean, dt: number }} o
 */
export function updateLoad(L, P, { action, run, dt }) {
  const flex = (a, b, c) => 180 - Math.min(angle3(P[a + 'L'], P[b + 'L'], P[c + 'L']), angle3(P[a + 'R'], P[b + 'R'], P[c + 'R']));
  const s2 = deg => Math.pow(Math.sin(deg * Math.PI / 360), 2), imp = run ? (IMPACT[action] || 0) : 0;
  const lean = Math.acos(clamp(dot(nrm(sub(P.chest, P.pel)), UP), -1, 1)), k = 1 - Math.exp(-dt / 0.25);
  L.knee += (0.5 + 3.0 * s2(flex('hip', 'kn', 'an')) + imp - L.knee) * k;
  L.hip += (0.5 + 2.4 * s2(flex('sh', 'hip', 'kn')) + 0.8 * imp - L.hip) * k;
  L.spine += (0.6 + 2.6 * Math.sin(lean) + 0.5 * imp - L.spine) * k;
}
