// Camera pose: MediaPipe Pose Landmarker world landmarks → the same {P, D} as solve(), keeping the figure's own bone
// lengths (only directions are taken from the landmarks). Plus the small 2D check view and the landmarker loader.
import { V, add, sub, mul, dot, cross, len, nrm, TAU, UP, DOWN, BACK, C } from '../core/math.js';
import { B, base, solve, settleGround } from '../core/skeleton.js';
import { ACT } from '../core/actions.js';

const LM = { ear: 7, sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, heel: 29, toe: 31 };   // left-side index; right side = +1
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
/** actions that hold dumbbells (the camera pose shows them in the hands too) */
export const HAS_PROP = Object.fromEntries(Object.keys(ACT).map(k => [k, ACT[k].pose(0, ACT[k].P).prop > 0.5]));

// One Euro filter, tuned for latency: at rest the cutoff is minCut (jitter stays low), and it rises with speed, so a
// squat is followed within a few tens of ms instead of the ~130 ms trail of a 1.2 Hz cutoff.
function oneEuro(minCut = 2, beta = 8, dCut = 2) {
  let x = null, dx = 0, tp = 0;
  const alpha = (cut, dt) => { const r = TAU * cut * dt; return r / (r + 1); };
  return (v, t) => {
    if (x === null) { x = v; tp = t; return v; }
    const dt = Math.max(1e-3, t - tp); tp = t;
    dx += ((v - x) / dt - dx) * alpha(dCut, dt);
    x += (v - x) * alpha(minCut + beta * Math.abs(dx), dt);
    return x;
  };
}

// prediction: each joint's velocity (from the filtered positions) carries it forward to the moment it is drawn plus
// a small lead, which hides most of the camera + model delay. Bounded, so a sudden stop overshoots only a little.
const VEL_CUT = 4;          // Hz, smoothing of the velocity estimate
const MAX_V = 3;            // m/s, faster estimates are clamped (detection glitches)
const MAX_H = 0.15;         // s, never extrapolate further than this
const STALE = 0.25;         // s, a joint not updated for this long is held, not extrapolated
const V_REST = 0.08, V_FULL = 0.25;   // m/s: below V_REST the joint counts as still (no prediction, so jitter is not amplified), full lead from V_FULL

/** @typedef {{ J: Record<string, import('../core/math.js').Vec3>, Vl: Record<string, import('../core/math.js').Vec3>, Tj: Record<string, number>,
 *   F: Record<string, Function[]>, tPrev: number, seen: number, motion: number, fpsN: number, lm2d: object[] | null }} CamPose
 *   J = filtered joints (hip-centred), Vl = their velocities (m/s), Tj = when each joint was last updated (s),
 *   seen = last time both shoulders were visible (ms), motion = mean limb speed (m/s) */
/** @returns {CamPose} */
export const createCamPose = () => { const c = { J: null, Vl: {}, Tj: {}, F: {}, tPrev: 0, seen: -1e9, motion: 0, fpsN: 0, lm2d: null }; camSeed(c); return c; };

/** neutral standing pose, so joints that have never been seen have a "last frame" to fall back on */
export function camSeed(cam) {
  const n = solve(base()), r = k => sub(n.P[k], n.P.pel), J = {};
  for (const s of ['L', 'R']) {
    for (const k of ['sh', 'el', 'wr', 'hip', 'kn', 'an', 'heel', 'toe']) J[k + s] = r(k + s);
    J['ear' + s] = add(r('head'), V(s === 'L' ? 0.1 : -0.1, 0, 0));
  }
  J.nose = add(r('head'), V(0, -0.02, 0.17));
  cam.J = J; cam.Vl = {}; cam.Tj = {}; cam.F = {}; cam.motion = 0; cam.seen = -1e9;
}

/** one detection result into the filtered joints; mir = mirror view */
export function camIngest(cam, res, now, mir) {
  const wl = res.worldLandmarks && res.worldLandmarks[0];
  cam.lm2d = (res.landmarks && res.landmarks[0]) || null;
  if (!wl) return;
  const t = now / 1000, dt = t - cam.tPrev, J = cam.J;
  const vis = i => wl[i].visibility == null ? 1 : wl[i].visibility;
  let mv = 0, mvN = 0;
  const put = (name, i, track) => {
    if (vis(i) < 0.5) return;                                   // low confidence: keep the previous frame's value
    const p = wl[i], f = cam.F[name] || (cam.F[name] = [oneEuro(), oneEuro(), oneEuro()]);
    // MediaPipe world space is x → image right, y → down, z → away from the camera; ours is X = character's left, Y up, Z front.
    // Mirroring flips X and (below) swaps which side of the body feeds L / R, so the figure moves like a mirror image.
    const v = V(f[0](mir ? -p.x : p.x, t), f[1](-p.y, t), f[2](-p.z, t));
    const tj = cam.Tj[name], dj = tj == null ? 0 : t - tj;
    if (dj > 0 && dj < STALE) {
      const raw = mul(sub(v, J[name]), 1 / dj), sp = len(raw), a = 1 - Math.exp(-TAU * VEL_CUT * dj);
      const lim = sp > MAX_V ? mul(raw, MAX_V / sp) : raw, old = cam.Vl[name] || V(0, 0, 0);
      cam.Vl[name] = add(old, mul(sub(lim, old), a));
    } else cam.Vl[name] = V(0, 0, 0);
    cam.Tj[name] = t;
    if (track && dt > 0 && dt < 0.5) { mv += len(sub(v, J[name])) / dt; mvN++; }
    J[name] = v;
  };
  put('nose', 0);
  for (const k in LM) for (const s of ['L', 'R']) put(k + s, LM[k] + ((s === 'R') !== mir ? 1 : 0), k === 'el' || k === 'wr' || k === 'kn' || k === 'an');
  if (mvN) cam.motion += (mv / mvN - cam.motion) * 0.2;       // mean limb speed relative to the hips, m/s
  cam.tPrev = t; cam.fpsN++;
  if (vis(11) >= 0.5 && vis(12) >= 0.5) cam.seen = now;
}

/**
 * the filtered joints carried forward to `now` + lead (s); joints that are stale or have no velocity yet stay put
 * @param {CamPose} cam @param {number} now ms @param {number} lead s
 * @returns {Record<string, import('../core/math.js').Vec3>}
 */
export function camPredict(cam, now, lead) {
  if (!(lead > 0)) return cam.J;
  const t = now / 1000, out = {};
  for (const k in cam.J) {
    const tj = cam.Tj[k], vl = cam.Vl[k];
    const h = tj == null || !vl || t - tj > STALE ? 0 : Math.min(MAX_H, Math.max(0, t - tj + lead));
    const g = h > 0 ? Math.min(1, Math.max(0, (len(vl) - V_REST) / (V_FULL - V_REST))) : 0;
    out[k] = g > 0 ? add(cam.J[k], mul(vl, h * g)) : cam.J[k];
  }
  return out;
}

/** @param {CamPose} cam @param {string} action @param {Record<string, import('../core/math.js').Vec3>} [J] joints to use (default: the filtered ones)
 * @returns {import('../core/skeleton.js').Solved} */
export function camSolve(cam, action, J = cam.J) {
  const P = {}, D = {};
  const dir = (a, b, fb) => { const d = sub(b, a); return len(d) > 1e-4 ? nrm(d) : fb; };
  const perp = (v, n, fb) => { const p = sub(v, mul(n, dot(v, n))); return len(p) > 1e-3 ? nrm(p) : fb; };
  const pelJ = mul(add(J.hipL, J.hipR), 0.5), shJ = mul(add(J.shL, J.shR), 0.5);
  const up = dir(pelJ, shJ, UP), side = perp(sub(J.shL, J.shR), up, V(1, 0, 0)), bodyF = cross(side, up);   // facing from the shoulder line
  const hipAx = dir(J.hipR, J.hipL, side);
  P.pel = V(0, 0, 0); P.pelBot = mul(up, 0.02); P.chest = mul(up, B.torso);
  for (const [n, s] of [['L', 1], ['R', -1]]) {
    const sh = add(P.chest, add(mul(side, s * B.shW), mul(up, -0.03)));
    const u = dir(J['sh' + n], J['el' + n], DOWN), lo = dir(J['el' + n], J['wr' + n], u);
    const el = add(sh, mul(u, B.ua)), wr = add(el, mul(lo, B.fa));
    P['sh' + n] = sh; P['el' + n] = el; P['wr' + n] = wr;
    P['hand' + n] = add(wr, mul(lo, 0.1)); P['thumb' + n] = add(P['hand' + n], mul(perp(bodyF, lo, up), 0.055));
    const hip = mul(hipAx, s * B.hipW), tu = dir(J['hip' + n], J['kn' + n], DOWN), sl = dir(J['kn' + n], J['an' + n], tu);
    const kn = add(hip, mul(tu, B.thigh)), an = add(kn, mul(sl, B.shin));
    P['hip' + n] = hip; P['kn' + n] = kn; P['an' + n] = an;
    const fd = dir(J['heel' + n], J['toe' + n], bodyF), sole = perp(DOWN, fd, BACK);
    P['heel' + n] = add(add(an, mul(fd, -0.042)), mul(sole, 0.058));
    P['toe' + n] = add(add(an, mul(fd, 0.15)), mul(sole, 0.066));
  }
  const earM = mul(add(J.earL, J.earR), 0.5), earAx = dir(J.earR, J.earL, side);
  const hf = perp(sub(J.nose, earM), earAx, bodyF), hu = cross(hf, earAx);
  P.head = add(P.chest, mul(nrm(add(mul(dir(shJ, earM, up), 0.6), mul(up, 0.4))), B.headUp));
  D.hu = hu; D.hf = hf; D.bodyF = bodyF; D.side = side; D.pelF = cross(hipAx, up);
  const minB = Math.min(P.heelL.y, P.toeL.y, P.heelR.y, P.toeR.y) - B.footR;      // world landmarks are hip-centred: stand the figure on the floor
  const lift = V(0, -settleGround(minB), 0);
  for (const k in P) P[k] = add(P[k], lift);
  return { P, D, prop: HAS_PROP[action], jump: 0 };
}

/** small 2D check view: ivory / orange = confident, grey = low visibility (held) */
export function camDraw(g, lm2d) {
  const c = g.canvas, w = c.width, h = c.height, l = lm2d;
  g.clearRect(0, 0, w, h);
  if (!l) return;
  const ok = i => (l[i].visibility == null ? 1 : l[i].visibility) >= 0.5;
  g.lineWidth = 4; g.lineCap = 'round';
  for (const [a, b] of BONES) {
    g.strokeStyle = ok(a) && ok(b) ? C.ivory : C.off;
    g.beginPath(); g.moveTo(l[a].x * w, l[a].y * h); g.lineTo(l[b].x * w, l[b].y * h); g.stroke();
  }
  for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    g.fillStyle = ok(i) ? C.acc : C.off;
    g.beginPath(); g.arc(l[i].x * w, l[i].y * h, 5, 0, TAU); g.fill();
  }
}

/** the Pose Landmarker (full model), GPU if possible; wasm and model are served from public/mediapipe/ */
export async function loadLandmarker() {
  const v = await import('@mediapipe/tasks-vision');
  const root = import.meta.env.BASE_URL + 'mediapipe/';
  const files = await v.FilesetResolver.forVisionTasks(root + 'wasm');
  const make = delegate => v.PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: root + 'pose_landmarker_full.task', delegate }, runningMode: 'VIDEO', numPoses: 1 });
  try { return await make('GPU'); } catch { return await make('CPU'); }
}
