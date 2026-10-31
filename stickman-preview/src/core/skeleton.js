// The figure's skeleton: bone lengths, the pose descriptor `q` and solve(q) → joint positions P and direction frames D.
import { V, add, sub, mul, dot, len, nrm, rotX, rotY, rotZ, lerp, sine, clamp, TAU, UP, DOWN, FWD, BACK } from './math.js';

/** @typedef {import('./math.js').Vec3} Vec3 */
/** @typedef {{ f: number, a: number, e: number, toe: number, b: Vec3 | null }} LimbParams  flex, abduction, elbow / knee bend, toe pitch, bend direction */
/** @typedef {{ yaw: number, lean: number, twist: number, side: number, nod: number, tilt: number, jump: number, anchor: number, prop: number,
 *   armL: LimbParams, armR: LimbParams, legL: LimbParams, legR: LimbParams }} PoseQ */
/** @typedef {Record<string, Vec3>} Joints  pel, chest, pelBot, head, sh/el/wr/hand/thumb L|R, hip/kn/an/heel/toe L|R */
/** @typedef {{ hu: Vec3, hf: Vec3, bodyF: Vec3, side: Vec3, pelF: Vec3 }} Frames */
/** @typedef {{ P: Joints, D: Frames, prop?: boolean, grip?: { L: number, R: number }, jump?: number }} Solved  grip = tracked hand closure 0..1 (camera) */

// segment lengths measured on the human model (male_body.glb, 180 cm = 1.5 units); see MJ in the render section
export const B = { hipW: 0.079, shW: 0.142, torso: 0.487, thigh: 0.318, shin: 0.343, ua: 0.26, fa: 0.225, headUp: 0.178, headR: 0.1,
  torsoR: 0.17, torsoZ: 0.8, armR: 0.06, foreR: 0.056, thighR: 0.085, shinR: 0.074, footR: 0.017, handR: 0.078, thumbR: 0.034 };
export function cycle(t, P, f) {
  let u = ((t / P) % 1 + 1) % 1; const [a, b, c] = f;
  if (u < a) return sine(u / a); u -= a;
  if (u < b) return 1; u -= b;
  if (u < c) return 1 - sine(u / c);
  return 0;
}
export const limbP = (f, a, e, toe = 0, b = null) => ({ f, a, e, toe, b });
/** @returns {PoseQ} */
export function base() {
  return { yaw: 0, lean: 0.03, twist: 0, side: 0, nod: 0, tilt: 0, jump: 0, anchor: 1, prop: 0,
    armL: limbP(0.04, 0.22, 0.2), armR: limbP(0.04, 0.22, 0.2), legL: limbP(0, 0.05, 0.04), legR: limbP(0, 0.05, 0.04) };
}
export function gait(q, w, o) {
  for (const [n, ph] of [['L', w], ['R', w + Math.PI]]) {
    const sw = Math.max(0, Math.cos(ph)), leg = q['leg' + n], arm = q['arm' + n];
    leg.f = o.A * Math.sin(ph); leg.e = o.kb + o.ks * Math.pow(sw, 1.5); leg.toe = o.toe * sw; leg.a = 0.04;
    arm.f = -o.arm * Math.sin(ph); arm.e = o.elb; arm.a = 0.16;
  }
  q.twist = o.tw * Math.sin(w); q.anchor = 0;
}

// ground contact, shared by solve() and the camera retargeting: `sm` is the smoothed lowest foot point,
// `k` the per-frame smoothing factor the loop sets (1 = snap)
export const ground = { sm: null, k: 1 };
/** smooths the lowest foot point and returns the height to subtract so the feet stay on the floor */
export function settleGround(minB) {
  if (ground.sm === null) ground.sm = minB; ground.sm += (minB - ground.sm) * ground.k;
  return ground.sm;
}

/** @param {PoseQ} q @returns {Solved} */
export function solve(q) {
  const Wp = v => rotY(v, q.yaw - 0.7 * q.twist);   // pelvis: turns against the shoulders when walking / running
  const Ub = v => rotY(rotX(rotZ(rotY(v, q.twist), q.side), q.lean), q.yaw);
  const P = {}, D = {};
  const pel = V(0, 0, 0), chest = Ub(V(0, B.torso, 0));
  P.pel = pel; P.chest = chest; P.pelBot = Ub(V(0, 0.02, 0));
  const hu = Ub(rotZ(rotX(UP, q.nod), q.tilt)), hf = Ub(rotZ(rotX(FWD, q.nod), q.tilt));
  P.head = add(chest, mul(hu, B.headUp)); D.hu = hu; D.hf = hf; D.bodyF = Ub(FWD); D.side = Ub(V(1, 0, 0)); D.pelF = Wp(FWD);
  function limb(n, s, p, isLeg, F, root) {
    const u = rotX(rotZ(DOWN, s * p.a), -p.f);
    const def = isLeg ? rotX(BACK, -p.f) : rotX(FWD, -p.f);
    let b = p.b || def, bp = sub(b, mul(u, dot(b, u)));
    if (len(bp) < 1e-3) bp = def; bp = nrm(bp);
    const lo = add(mul(u, Math.cos(p.e)), mul(bp, Math.sin(p.e)));
    if (!isLeg) {                                      // shoulder girdle: the shoulder rises (and comes in a little) as the arm goes up
      const g = clamp((Math.acos(clamp(-u.y, -1, 1)) - 0.5) / 2.3, 0, 1), k = g * g * (3 - 2 * g);
      root = add(root, F(V(-s * 0.012 * k, 0.045 * k, 0)));
    }
    const mid = add(root, F(mul(u, isLeg ? B.thigh : B.ua))), end = add(mid, F(mul(lo, isLeg ? B.shin : B.fa)));
    if (isLeg) {
      P['hip' + n] = root; P['kn' + n] = mid; P['an' + n] = end;
      const fd = Wp(rotY(rotX(FWD, p.toe || 0), s * 0.1)), sole = Wp(rotX(DOWN, p.toe || 0));
      P['heel' + n] = add(add(end, mul(fd, -0.042)), mul(sole, 0.058));
      P['toe' + n] = add(add(end, mul(fd, 0.15)), mul(sole, 0.066));
    } else {
      P['sh' + n] = root; P['el' + n] = mid; P['wr' + n] = end;
      P['hand' + n] = add(end, F(mul(lo, 0.1)));       // palm centre, matches the model's hand
      P['thumb' + n] = add(P['hand' + n], F(mul(bp, 0.055)));
    }
  }
  limb('L', 1, q.armL, false, Ub, add(chest, Ub(V(B.shW, -0.03, 0))));
  limb('R', -1, q.armR, false, Ub, add(chest, Ub(V(-B.shW, -0.03, 0))));
  limb('L', 1, q.legL, true, Wp, Wp(V(B.hipW, 0, 0)));
  limb('R', -1, q.legR, true, Wp, Wp(V(-B.hipW, 0, 0)));
  const minB = Math.min(P.heelL.y, P.toeL.y, P.heelR.y, P.toeR.y) - B.footR;
  const gSm = settleGround(minB);
  const ax = lerp(0, -(P.anL.x + P.anR.x) / 2, q.anchor), az = lerp(0, -(P.anL.z + P.anR.z) / 2, q.anchor);
  const sh = V(ax, -gSm + q.jump, az);
  for (const k in P) P[k] = add(P[k], sh);
  return { P, D, prop: q.prop > 0.5, jump: q.jump };
}
/** blends two pose descriptors; yaw takes the short way round */
export function lerpQ(a, b, k) {
  const o = {};
  for (const key in b) {
    const A = a[key], Bv = b[key];
    if (typeof Bv === 'number') {
      if (key === 'yaw') { const d = ((Bv - A) % TAU + TAU * 1.5) % TAU - Math.PI; o[key] = A + d * k; }
      else o[key] = lerp(A, Bv, k);
    } else {
      const l = {};
      for (const kk of ['f', 'a', 'e', 'toe']) l[kk] = lerp(A[kk] || 0, Bv[kk] || 0, k);
      const isLeg = key.startsWith('leg');
      const defB = p => p.b || (isLeg ? rotX(BACK, -p.f) : rotX(FWD, -p.f));
      const ba = defB(A), bb = defB(Bv);
      l.b = (A.b || Bv.b) ? V(lerp(ba.x, bb.x, k), lerp(ba.y, bb.y, k), lerp(ba.z, bb.z, k)) : null;
      o[key] = l;
    }
  }
  return o;
}
/** angle at b (degrees) between b→a and b→c */
export function angle3(a, b, c) {
  const v1 = sub(a, b), v2 = sub(c, b);
  return Math.acos(clamp(dot(v1, v2) / ((len(v1) * len(v2)) || 1), -1, 1)) * 180 / Math.PI;
}
