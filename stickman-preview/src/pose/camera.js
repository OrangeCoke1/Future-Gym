// Camera pose: MediaPipe Pose Landmarker world landmarks → the same {P, D} as solve(), keeping the figure's own bone
// lengths (only directions are taken from the landmarks). Plus the small 2D check view and the landmarker loader.
import { V, add, sub, mul, dot, cross, len, nrm, TAU, UP, DOWN, BACK, C } from '../core/math.js';
import { B, base, solve, settleGround } from '../core/skeleton.js';
import { ACT } from '../core/actions.js';
import { CAM_TUNE_DEFAULT } from './camTune.js';
import { createHands, rollAxis, handLive } from './hands.js';

const LM = { ear: 7, sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, heel: 29, toe: 31 };   // left-side index; right side = +1
const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [27, 31], [28, 32]];
/** actions that hold dumbbells (the camera pose shows them in the hands too) */
export const HAS_PROP = Object.fromEntries(Object.keys(ACT).map(k => [k, ACT[k].pose(0, ACT[k].P).prop > 0.5]));

// One Euro filter: at rest the cutoff is tune.minCut (jitter stays low), and it rises by tune.beta per m/s of speed, so
// fast moves are followed closely. The tuning object is read on every sample, so panel changes apply at once.
// km / kb scale the cutoff and the speed response for one axis (depth is much noisier than x / y); cs (per sample) lowers
// the cutoff for unsure joints.
function oneEuro(tune, km = 1, kb = 1, dCut = 2) {
  let x = null, dx = 0, tp = 0;
  const alpha = (cut, dt) => { const r = TAU * cut * dt; return r / (r + 1); };
  return (v, t, cs = 1) => {
    if (x === null) { x = v; tp = t; return v; }
    const dt = Math.max(1e-3, t - tp); tp = t;
    dx += ((v - x) / dt - dx) * alpha(dCut, dt);
    x += (v - x) * alpha(cs * (km * tune.minCut + kb * tune.beta * Math.abs(dx)), dt);
    return x;
  };
}
const Z_KM = 0.4, Z_KB = 0.5;   // depth axis: cutoff × 0.4, speed response × 0.5
const VIS_T = 0.2;          // s, smoothing of each joint's visibility (its confidence)
const FRAME_CUT = 4;        // Hz, smoothing of the body frame (up / side)
const FACE_DEAD = 1.5 * Math.PI / 180;   // rad, facing changes smaller than this are ignored (no rocking while standing)
const clamp01 = x => Math.min(1, Math.max(0, x));
// 2D / 3D fusion: the world landmarks' x / y are a regressed 3D guess that often sits a few degrees off the person in
// the picture, while the image landmarks line up with the pixels. So x / y come mostly from the image (scaled to
// metres by the torso), and only depth z from the world landmarks.
const FUSE_2D = 0.8;        // share of the image landmarks in x / y
const SCALE_A = 0.15;       // per-frame smoothing of the image → metres scale
const TORSO = [[11, 12], [23, 24]];

// prediction: each joint's velocity (from the filtered positions) carries it forward to the moment it is drawn plus
// a small lead, which hides most of the camera + model delay. Bounded, so a sudden stop overshoots only a little.
const VEL_CUT = 4;          // Hz, smoothing of the velocity estimate
const MAX_V = 3;            // m/s, faster estimates are clamped (detection glitches)
const MAX_H = 0.15;         // s, never extrapolate further than this
const STALE = 0.25;         // s, a joint not updated for this long is held, not extrapolated
const V_REST = 0.15, V_FULL = 0.35;   // m/s: below V_REST the joint counts as still (no prediction, so jitter is not amplified), full lead from V_FULL

/** @typedef {import('../core/math.js').Vec3} Vec3 */
/** @typedef {{ J: Record<string, Vec3>, Vl: Record<string, Vec3>, Tj: Record<string, number>, Vis: Record<string, number>,
 *   F: Record<string, Function[]>, hands: ReturnType<typeof createHands>, tune: import('./camTune.js').CamTune, up: Vec3 | null, side: Vec3 | null, face: Vec3 | null,
 *   tPrev: number, seen: number, motion: number, fpsN: number, lm2d: object[] | null }} CamPose
 *   J = filtered joints (hip-centred), Vl = their velocities (m/s), Tj = when each joint was last updated (s),
 *   Vis = smoothed visibility (0..1, the joint's confidence), up / side = smoothed body frame, face = side with a dead-band,
 *   seen = last time both shoulders were visible (ms), motion = mean limb speed (m/s) */
/** @returns {CamPose} */
export const createCamPose = () => {
  const c = { J: null, Vl: {}, Tj: {}, Vis: {}, F: {}, hands: createHands(), tune: { ...CAM_TUNE_DEFAULT }, up: null, side: null, face: null,
    tPrev: 0, seen: -1e9, motion: 0, fpsN: 0, lm2d: null, aspect: 4 / 3, s2d: 0 };
  camSeed(c); return c;
};

/** neutral standing pose, so joints that have never been seen have a "last frame" to fall back on */
export function camSeed(cam) {
  const n = solve(base()), r = k => sub(n.P[k], n.P.pel), J = {};
  for (const s of ['L', 'R']) {
    for (const k of ['sh', 'el', 'wr', 'hip', 'kn', 'an', 'heel', 'toe']) J[k + s] = r(k + s);
    J['ear' + s] = add(r('head'), V(s === 'L' ? 0.1 : -0.1, 0, 0));
  }
  J.nose = add(r('head'), V(0, -0.02, 0.17));
  cam.J = J; cam.Vl = {}; cam.Tj = {}; cam.Vis = {}; cam.F = {}; cam.up = cam.side = cam.face = null; cam.motion = 0; cam.seen = -1e9; cam.s2d = 0;
}

/**
 * world landmarks with x / y taken mostly from the image landmarks (see FUSE_2D); the world ones unchanged when the
 * torso is not seen well enough to scale the image
 * @param {CamPose} cam @param {object[]} wl world landmarks @param {object[] | null} l image landmarks (0..1)
 * @returns {object[]}
 */
export function fuse2d(cam, wl, l) {
  if (!l || l.length < 25) return wl;
  const vis = p => (p.visibility == null ? 1 : p.visibility);
  if ([11, 12, 23, 24].some(i => vis(l[i]) < 0.6)) return wl;
  const ax = cam.aspect > 0 ? cam.aspect : 4 / 3;
  const ix = i => l[i].x * ax, iy = i => l[i].y;
  const mid = (f, a, b) => (f(a) + f(b)) / 2;
  let lw = 0, li = 0;
  const seg = (a, b, wa, wb) => { lw += Math.hypot(wa.x - wb.x, wa.y - wb.y); li += Math.hypot(a[0] - b[0], a[1] - b[1]); };
  for (const [a, b] of TORSO) seg([ix(a), iy(a)], [ix(b), iy(b)], wl[a], wl[b]);
  seg([mid(ix, 11, 12), mid(iy, 11, 12)], [mid(ix, 23, 24), mid(iy, 23, 24)],
    { x: (wl[11].x + wl[12].x) / 2, y: (wl[11].y + wl[12].y) / 2 }, { x: (wl[23].x + wl[24].x) / 2, y: (wl[23].y + wl[24].y) / 2 });
  if (!(li > 1e-4) || !(lw > 1e-3)) return wl;
  const s = lw / li;
  cam.s2d = cam.s2d > 0 ? cam.s2d + (s - cam.s2d) * SCALE_A : s;
  const k = cam.s2d, cx = mid(ix, 23, 24), cy = mid(iy, 23, 24);
  const wx = (wl[23].x + wl[24].x) / 2, wy = (wl[23].y + wl[24].y) / 2;          // world origin is about the hip midpoint
  return wl.map((p, i) => ({
    x: p.x + (wx + (ix(i) - cx) * k - p.x) * FUSE_2D,
    y: p.y + (wy + (iy(i) - cy) * k - p.y) * FUSE_2D,
    z: p.z, visibility: p.visibility
  }));
}

/** one detection result into the filtered joints; mir = mirror view */
export function camIngest(cam, res, now, mir) {
  const w0 = res.worldLandmarks && res.worldLandmarks[0];
  cam.lm2d = (res.landmarks && res.landmarks[0]) || null;
  if (!w0) return;
  const wl = fuse2d(cam, w0, cam.lm2d);
  const t = now / 1000, dt = t - cam.tPrev, J = cam.J;
  const vis = i => wl[i].visibility == null ? 1 : wl[i].visibility;
  let mv = 0, mvN = 0;
  const va = dt > 0 && dt < 0.5 ? 1 - Math.exp(-dt / VIS_T) : 1;
  const put = (name, i, track) => {
    const c0 = cam.Vis[name] == null ? vis(i) : cam.Vis[name], conf = c0 + (vis(i) - c0) * va;
    cam.Vis[name] = conf;
    if (vis(i) < 0.5) return;                                   // low confidence: keep the previous frame's value
    const p = wl[i], tn = cam.tune, f = cam.F[name] || (cam.F[name] = [oneEuro(tn), oneEuro(tn), oneEuro(tn, Z_KM, Z_KB)]);
    const cs = 0.4 + 0.6 * clamp01((conf - 0.5) / 0.4);         // unsure joints are smoothed harder
    // MediaPipe world space is x → image right, y → down, z → away from the camera; ours is X = character's left, Y up, Z front.
    // Mirroring flips X and (below) swaps which side of the body feeds L / R, so the figure moves like a mirror image.
    const v = V(f[0](mir ? -p.x : p.x, t, cs), f[1](-p.y, t, cs), f[2](-p.z, t, cs));
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
  updateFrame(cam, dt > 0 && dt < 0.5 ? dt : 0);
  cam.tPrev = t; cam.fpsN++;
  if (vis(11) >= 0.5 && vis(12) >= 0.5) cam.seen = now;
}

/** the body frame from the hips and shoulders, low-passed, and a facing that ignores changes under FACE_DEAD */
function updateFrame(cam, dt) {
  const J = cam.J, pel = mul(add(J.hipL, J.hipR), 0.5), sh = mul(add(J.shL, J.shR), 0.5);
  const d = sub(sh, pel), up = len(d) > 1e-4 ? nrm(d) : UP;
  const sd = sub(J.shL, J.shR), sp = sub(sd, mul(up, dot(sd, up))), side = len(sp) > 1e-3 ? nrm(sp) : V(1, 0, 0);
  if (!cam.up || !dt) { cam.up = up; cam.side = side; cam.face = side; return; }
  const a = 1 - Math.exp(-TAU * FRAME_CUT * dt);
  cam.up = nrm(add(cam.up, mul(sub(up, cam.up), a)));
  cam.side = nrm(add(cam.side, mul(sub(side, cam.side), a)));
  const ang = Math.acos(Math.min(1, Math.max(-1, dot(cam.face, cam.side))));
  if (ang > FACE_DEAD) {                                      // follow, staying FACE_DEAD behind
    const k = (ang - FACE_DEAD) / ang;
    cam.face = nrm(add(cam.face, mul(sub(cam.side, cam.face), k)));
  }
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
    // only clearly moving, confidently seen joints are extrapolated: prediction would amplify the rest's noise
    const g = h > 0 ? clamp01((len(vl) - V_REST) / (V_FULL - V_REST)) * clamp01(((cam.Vis[k] ?? 1) - 0.6) / 0.2) : 0;
    out[k] = g > 0 ? add(cam.J[k], mul(vl, h * g)) : cam.J[k];
  }
  return out;
}

// legs: anatomical limits (radians) for the thigh in the body frame, the knee and the foot
const HIP_FWD = [-30, 125].map(d => d * Math.PI / 180), HIP_OUT = [-20, 50].map(d => d * Math.PI / 180);
const KNEE_MAX = Math.cos(150 * Math.PI / 180), FOOT_MAX = 45 * Math.PI / 180;
const nlerp = (a, b, k) => { const v = add(mul(a, 1 - k), mul(b, k)); return len(v) > 1e-6 ? nrm(v) : b; };

/** how much a leg's tracked pose is trusted (0 = neutral standing leg), from its smoothed visibilities */
export function legConf(cam, n) {
  if (cam.tune.legs === 'stand') return 0;
  const v = Math.min(cam.Vis['hip' + n] ?? 0, cam.Vis['kn' + n] ?? 0, cam.Vis['an' + n] ?? 0);
  return clamp01((v - 0.55) / 0.25);
}

/**
 * thigh and shin directions for one leg: knee never bent backwards, hip and knee within human range, then blended
 * towards a neutral standing leg by confidence w
 * @returns {{ tu: Vec3, sl: Vec3 }}
 */
function legDirs(J, n, s, up, side, bodyF, w) {
  const down = mul(up, -1), out = mul(side, s);
  const tuN = nrm(add(down, mul(out, 0.05)));
  if (w <= 0) return { tu: tuN, sl: down };
  const hip = J['hip' + n], an = J['an' + n];
  let kn = J['kn' + n];
  const ln = sub(an, hip), L2 = dot(ln, ln);
  if (L2 > 1e-6) {                                             // knee behind the hip–ankle line: mirror it to the front
    const foot = add(hip, mul(ln, dot(sub(kn, hip), ln) / L2)), off = sub(kn, foot);
    if (dot(off, bodyF) < 0) kn = sub(foot, off);
  }
  const raw = sub(kn, hip);
  let tu = len(raw) > 1e-4 ? nrm(raw) : tuN;
  const fwd = Math.atan2(dot(tu, bodyF), dot(tu, down)), ab = Math.asin(Math.min(1, Math.max(-1, dot(tu, out))));
  const f2 = Math.min(HIP_FWD[1], Math.max(HIP_FWD[0], fwd)), a2 = Math.min(HIP_OUT[1], Math.max(HIP_OUT[0], ab));
  if (f2 !== fwd || a2 !== ab) tu = nrm(add(mul(out, Math.sin(a2)), mul(add(mul(down, Math.cos(f2)), mul(bodyF, Math.sin(f2))), Math.cos(a2))));
  const rs = sub(an, kn);
  let sl = len(rs) > 1e-4 ? nrm(rs) : tu;
  if (dot(sl, tu) < KNEE_MAX) {                               // more than 150° of knee flexion
    const pp = sub(sl, mul(tu, dot(sl, tu))), q = len(pp) > 1e-4 ? nrm(pp) : bodyF;
    sl = nrm(add(mul(tu, KNEE_MAX), mul(q, Math.sqrt(1 - KNEE_MAX * KNEE_MAX))));
  }
  return { tu: nlerp(tuN, tu, w), sl: nlerp(down, sl, w) };
}

/** foot direction: within FOOT_MAX of the facing, and the facing itself when the foot is not seen well */
function footDir(cam, J, n, bodyF, fb) {
  const d = sub(J['toe' + n], J['heel' + n]);
  if (len(d) < 1e-4) return fb;
  let fd = nrm(d);
  const ang = Math.acos(Math.min(1, Math.max(-1, dot(fd, bodyF))));
  if (ang > FOOT_MAX) { const pp = sub(fd, mul(bodyF, dot(fd, bodyF))); fd = len(pp) > 1e-4 ? nrm(add(mul(bodyF, Math.cos(FOOT_MAX)), mul(nrm(pp), Math.sin(FOOT_MAX)))) : bodyF; }
  const w = cam.tune.legs === 'stand' ? 0 : clamp01((Math.min(cam.Vis['heel' + n] ?? 0, cam.Vis['toe' + n] ?? 0) - 0.55) / 0.25);
  return nlerp(fb, fd, w);
}

/**
 * @param {CamPose} cam @param {boolean} prop dumbbells in the hands
 * @param {Record<string, Vec3>} [J] joints to use (default: the filtered ones)
 * @returns {import('../core/skeleton.js').Solved}
 */
export function camSolve(cam, prop, J = cam.J, now = performance.now()) {
  const P = {}, D = {}, grip = { L: 0, R: 0 };
  const dir = (a, b, fb) => { const d = sub(b, a); return len(d) > 1e-4 ? nrm(d) : fb; };
  const perp = (v, n, fb) => { const p = sub(v, mul(n, dot(v, n))); return len(p) > 1e-3 ? nrm(p) : fb; };
  const shJ = mul(add(J.shL, J.shR), 0.5);
  // body frame: the smoothed one from camIngest (facing with a dead-band), or straight from the joints before the first frame
  const pelJ = mul(add(J.hipL, J.hipR), 0.5);
  const up = cam.up || dir(pelJ, shJ, UP), side = perp(cam.face || sub(J.shL, J.shR), up, V(1, 0, 0)), bodyF = cross(side, up);
  const hipAx = perp(dir(J.hipR, J.hipL, side), up, side);
  P.pel = V(0, 0, 0); P.pelBot = mul(up, 0.02); P.chest = mul(up, B.torso);
  for (const [n, s] of [['L', 1], ['R', -1]]) {
    const sh = add(P.chest, add(mul(side, s * B.shW), mul(up, -0.03)));
    const u = dir(J['sh' + n], J['el' + n], DOWN), lo = dir(J['el' + n], J['wr' + n], u);
    const el = add(sh, mul(u, B.ua)), wr = add(el, mul(lo, B.fa));
    P['sh' + n] = sh; P['el' + n] = el; P['wr' + n] = wr;
    // wrist roll: the tracked palm axis (hand tracking on and the hand just seen), else the body's facing
    const hs = cam.hands[n], ax = rollAxis(hs, lo, now);
    P['hand' + n] = add(wr, mul(lo, 0.1)); P['thumb' + n] = add(P['hand' + n], mul(ax || perp(bodyF, lo, up), 0.055));
    if (handLive(hs, now)) grip[n] = hs.grip;
    const { tu, sl } = legDirs(J, n, s, up, side, bodyF, legConf(cam, n));
    const hip = mul(hipAx, s * B.hipW), kn = add(hip, mul(tu, B.thigh)), an = add(kn, mul(sl, B.shin));
    P['hip' + n] = hip; P['kn' + n] = kn; P['an' + n] = an;
    const fd = footDir(cam, J, n, bodyF, nrm(add(bodyF, mul(side, s * 0.15)))), sole = perp(DOWN, fd, BACK);
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
  return { P, D, prop: !!prop, grip, jump: 0 };
}

/** small 2D check view: ivory / orange = confident, grey = low visibility (held) */
export function camDraw(g, lm2d) {
  const c = g.canvas, w = c.width, h = c.height, l = lm2d;
  g.clearRect(0, 0, w, h);
  if (!l) return;
  const ok = i => (l[i].visibility == null ? 1 : l[i].visibility) >= 0.5;
  const k = w / 336;                                       // sizes were tuned for a 336 px wide canvas
  g.lineWidth = 4 * k; g.lineCap = 'round';
  for (const [a, b] of BONES) {
    g.strokeStyle = ok(a) && ok(b) ? C.ivory : C.off;
    g.beginPath(); g.moveTo(l[a].x * w, l[a].y * h); g.lineTo(l[b].x * w, l[b].y * h); g.stroke();
  }
  for (const i of [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]) {
    g.fillStyle = ok(i) ? C.acc : C.off;
    g.beginPath(); g.arc(l[i].x * w, l[i].y * h, 5 * k, 0, TAU); g.fill();
  }
}

/** pose models in public/mediapipe/: heavy is more accurate (depth especially) and slower */
export const POSE_MODELS = { full: 'pose_landmarker_full.task', heavy: 'pose_landmarker_heavy.task' };
/** the Pose Landmarker, GPU if possible; wasm and model are served from public/mediapipe/
 * @param {'full' | 'heavy'} [model] */
export async function loadLandmarker(model = 'heavy') {
  const v = await import('@mediapipe/tasks-vision');
  const root = import.meta.env.BASE_URL + 'mediapipe/';
  const files = await v.FilesetResolver.forVisionTasks(root + 'wasm');
  const make = delegate => v.PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: root + (POSE_MODELS[model] || POSE_MODELS.heavy), delegate }, runningMode: 'VIDEO', numPoses: 1 });
  try { return await make('GPU'); } catch { return await make('CPU'); }
}
