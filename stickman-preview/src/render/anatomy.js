import { B } from '../core/skeleton.js';
import { clamp, lerp } from '../core/math.js';

// Body shape shared by the solid body (GLSL) and the particle body (JS), proportioned after a front-view anatomy
// reference: small head, neck, round deltoids, chest wider than the waist, slim tapering limbs, calf bulge.
// trunk = [height above the pelvis, half-width] pairs; depth = front-to-back / side-to-side; limb pairs = [r at start, r at end].
export const ANAT = { trunk: [[-0.11, 0.12], [0, 0.15], [0.14, 0.118], [0.3, 0.14], [0.38, 0.115]], depth: 0.66,
  neck: [0.05, 0.043, 0.11], trap: [0.06, 0.042, 0.03], head: [0.076, 0.105, 0.092], delt: 0.058, ua: [0.046, 0.036], fa: [0.036, 0.026], hand: [0.028, 0.022, 0.13],
  th: [0.08, 0.05], sh: [0.052, 0.03], calf: [0.012, 0.1, 0.07], foot: [0.036, 0.03] };
export const trunkHalf = y => { const T = ANAT.trunk; y = clamp(y, T[0][0], T[T.length - 1][0]); let i = 1; while (i < T.length - 1 && y > T[i][0]) i++; return lerp(T[i - 1][1], T[i][1], (y - T[i - 1][0]) / (T[i][0] - T[i - 1][0])); };
export const SEG = [                                         // bones; the radius is used for skin "membership" (muscle tint), not for the shape
  ['pelBot', 'chest', 0.135], ['head', 'head', B.headR],
  ['shL', 'elL', 0.045], ['elL', 'wrL', 0.034], ['handL', 'handL', 0.03],
  ['shR', 'elR', 0.045], ['elR', 'wrR', 0.034], ['handR', 'handR', 0.03],
  ['hipL', 'knL', 0.07], ['knL', 'anL', 0.045], ['heelL', 'toeL', 0.035],
  ['hipR', 'knR', 0.07], ['knR', 'anR', 0.045], ['heelR', 'toeR', 0.035]
];
