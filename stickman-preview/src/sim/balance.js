// Centre of mass from the 3D skeleton (segment midpoints weighted by typical body mass) and the left / right share of weight.
import { V, add, sub, mul, dot, clamp } from '../core/math.js';

export const MASS = [['head', 'head', 0.08], ['pel', 'chest', 0.46], ['shL', 'elL', 0.03], ['shR', 'elR', 0.03], ['elL', 'wrL', 0.025], ['elR', 'wrR', 0.025],
  ['hipL', 'knL', 0.11], ['hipR', 'knR', 0.11], ['knL', 'anL', 0.06], ['knR', 'anR', 0.06]];

/**
 * @param {import('../core/skeleton.js').Joints} P
 * @returns {{ com: import('../core/math.js').Vec3, upL: boolean, upR: boolean, target: number }}
 *   upL / upR = that foot is lifted; target = left share in %, before smoothing
 */
export function balanceOf(P) {
  let com = V(0, 0, 0), m = 0;
  for (const [a, b, k] of MASS) { com = add(com, mul(add(P[a], P[b]), 0.5 * k)); m += k; }
  com = mul(com, 1 / m);
  const upL = P.anL.y - P.anR.y > 0.04, upR = P.anR.y - P.anL.y > 0.04;
  // share of weight: where the drop point sits between the ankles; a lifted foot carries nothing
  const ab = sub(P.anL, P.anR), t = clamp((dot(sub(com, P.anR), V(ab.x, 0, ab.z))) / Math.max(1e-6, ab.x * ab.x + ab.z * ab.z), 0, 1);
  return { com, upL, upR, target: upL ? 0 : upR ? 100 : t * 100 };
}
/** smoothed left share (τ 0.2 s) */
export const smoothBalance = (l, target, dt) => l + (target - l) * (1 - Math.exp(-dt / 0.2));
