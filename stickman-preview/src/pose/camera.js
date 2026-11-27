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
// legs respond faster to speed than arms: on 8 recorded people squatting, doubling the leg response cut the knee lag by
// about a third for almost no extra jitter, while the arms (noisier, often near the body) got visibly shakier with it
const LEG_KB = 2, LEG_LEAD = 1.7, LEG_KB_J = /^(hip|kn|an|heel|toe)[LR]$/;
const VIS_T = 0.2;          // s, smoothing of each joint's visibility (its confidence)
const FRAME_CUT = 4;        // Hz, smoothing of the body frame (up / side)
const FACE_DEAD = 1.5 * Math.PI / 180;   // rad, facing changes smaller than this are ignored (no rocking while standing)
const clamp01 = x => Math.min(1, Math.max(0, x));
// levelling: a camera that is tilted (a laptop looking up, a phone on its side) makes the whole person lean in the
// world landmarks. The person's own vertical is measured while they stand straight (ankles → shoulders, legs straight)
// or, with the legs out of view, from the trunk while they hold still; its slow average is the camera's tilt, and
// camSolve() turns the whole pose so that vertical is straight up. Bending (squats, lunges) is never measured.
const LEVEL_T = 1.5;                          // s, time constant of the tilt estimate
const LEVEL_MAX = Math.cos(35 * Math.PI / 180);   // a "vertical" further than this from straight up is a real lean, not tilt
const LEG_STRAIGHT = Math.cos(25 * Math.PI / 180);
// 2D / 3D fusion: the world landmarks' x / y are a regressed 3D guess that often sits a few degrees off the person in
// the picture, while the image landmarks line up with the pixels. So x / y come mostly from the image (scaled to
// metres by the torso), and only depth z from the world landmarks.
const FUSE_2D = 0.8;        // share of the image landmarks in x / y
const SCALE_A = 0.15;       // per-frame smoothing of the image → metres scale
const TORSO = [[11, 12], [23, 24]];

// prediction: each joint's velocity (from the filtered positions) carries it forward to the moment it is drawn plus
// a small lead, which hides most of the camera + model delay. Bounded, so a sudden stop overshoots only a little.
const VEL_CUT = 3;          // Hz, smoothing of the velocity estimate
const MAX_V = 3;            // m/s, faster estimates are clamped (detection glitches)
const MAX_H = 0.15;         // s, never extrapolate further than this
const STALE = 0.25;         // s, a joint not updated for this long is held, not extrapolated
// depth is by far the noisiest axis of the landmarks, and a depth error barely shows in a front view: it is carried
// forward only by this share
const Z_PRED = 0.5;
const V_REST = 0.15, V_FULL = 0.35;   // m/s: below V_REST the joint counts as still (no prediction, so jitter is not amplified), full lead from V_FULL
// coherent motion: noise makes the velocity estimate point a new way every frame, real motion keeps its direction for a
// while. Over COH_T the length of the mean velocity against the mean speed is that coherence; prediction fades in
// between COH_LO and COH_HI, so a person holding still is never extrapolated along their own jitter.
const COH_T = 0.12, COH_LO = 0.7, COH_HI = 0.9;
// repetition range (squats, lunges; curls, presses): each knee's and elbow's angle over the last REP_WIN s. Once the knee has swung through at least
// REP_MIN degrees, the prediction of that leg (and the same for an arm at its elbow) (and, with both legs bending together, of the trunk) is cut short where it
// would carry the knee past the person's own deepest / straightest point by more than REP_PAD: velocity extrapolation
// otherwise overshoots at the bottom and the top of every rep, and that limited how much lead could be used.
const REP_WIN = 6, REP_MIN = 35, REP_PAD = 4;
const LEG_J = ['hip', 'kn', 'an', 'heel', 'toe'], TRUNK_J = ['shL', 'shR', 'earL', 'earR', 'nose'];

// glitch guard (tune.guard): MediaPipe now and then throws one joint far off for a frame or two, or swaps the left and
// right legs. One Euro then follows the jump at full speed (it reads it as a fast move) and prediction carries it on.
// A joint whose new position is further from its last accepted one than GATE_D plus a top speed allows is held for up
// to GATE_N frames (a real fast move keeps going and is taken on the next frame); a limb whose left and right fit the
// last frame clearly better crossed over is swapped back, for at most SWAP_MAX frames in a row (after that the new
// labelling is taken as right).
const GATE_D = 0.05, GATE_V = 2, GATE_VF = 3, GATE_N = 2;   // m, m/s (GATE_VF: wrists and elbows, the fastest joints)
const FAST_J = /^(wr|el)[LR]$/, RAW_VA = 0.5;   // per-frame smoothing of the raw velocity the guard extrapolates with
const SWAP_GROUPS = [['hip', 'kn', 'an', 'heel', 'toe'], ['el', 'wr']], SWAP_K = 0.5, SWAP_MIN = 0.06, SWAP_MAX = 8;
/** a MediaPipe world landmark in our axes (see camIngest) */
const rawOf = (p, mir) => V(mir ? -p.x : p.x, -p.y, -p.z);

/** @typedef {import('../core/math.js').Vec3} Vec3 */
/** @typedef {{ J: Record<string, Vec3>, Vl: Record<string, Vec3>, Tj: Record<string, number>, Vis: Record<string, number>,
 *   F: Record<string, Function[]>, hands: ReturnType<typeof createHands>, tune: import('./camTune.js').CamTune, up: Vec3 | null, side: Vec3 | null, face: Vec3 | null,
 *   tPrev: number, seen: number, motion: number, fpsN: number, lm2d: object[] | null }} CamPose
 *   J = filtered joints (hip-centred), Vl = their velocities (m/s), Tj = when each joint was last updated (s),
 *   Vis = smoothed visibility (0..1, the joint's confidence), up / side = smoothed body frame, face = side with a dead-band,
 *   seen = last time both shoulders were visible (ms), motion = mean limb speed (m/s) */
/** @returns {CamPose} */
export const createCamPose = () => {
  const c = { J: null, Vl: {}, Vm: {}, Vs: {}, Tj: {}, R: {}, Rv: {}, Tr: {}, Rej: {}, swapN: {}, Vis: {}, F: {}, hands: createHands(), tune: { ...CAM_TUNE_DEFAULT }, up: null, side: null, face: null,
    tPrev: 0, seen: -1e9, motion: 0, fpsN: 0, lm2d: null, aspect: 4 / 3, s2d: 0, vert: null };
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
  cam.J = J; cam.Vl = {}; cam.Vm = {}; cam.Vs = {}; cam.Tj = {}; cam.R = {}; cam.Rv = {}; cam.Tr = {}; cam.Rej = {}; cam.swapN = {}; cam.Vis = {}; cam.F = {}; cam.up = cam.side = cam.face = null; cam.motion = 0; cam.seen = -1e9; cam.s2d = 0; cam.vert = null;
  cam.kh = { knL: [], knR: [], elL: [], elR: [] };
}

/** the bending joints watched for a repetition range: name → [upper, joint, lower] joint name stems */
const REP_J = { kn: ['hip', 'kn', 'an'], el: ['sh', 'el', 'wr'] };
/** angle (°) at joint j ('kn' / 'el') of side n in joint set J */
const bendAng = (J, j, n) => {
  const [u, m, l] = REP_J[j].map(k => J[k + n]);
  const a = sub(u, m), b = sub(l, m), d = len(a) * len(b);
  return d > 1e-6 ? Math.acos(Math.min(1, Math.max(-1, dot(a, b) / d))) * 180 / Math.PI : 180;
};

/** remember each confidently seen knee and elbow angle for the repetition range (REP_WIN) */
function trackReps(cam, t) {
  for (const j in REP_J) for (const n of ['L', 'R']) {
    const h = cam.kh[j + n];
    if (Math.min(...REP_J[j].map(k => cam.Vis[k + n] ?? 0)) >= 0.6) h.push({ t, a: bendAng(cam.J, j, n) });
    while (h.length && t - h[0].t > REP_WIN) h.shift();
  }
}

/** [lo, hi] of joint j's recent angles on side n, or null while it has not moved through a repetition */
function repRange(cam, j, n, t) {
  const h = cam.kh[j + n];
  if (h.length < 10 || t - h[h.length - 1].t > STALE) return null;
  let lo = Infinity, hi = -Infinity;
  for (const e of h) { if (e.a < lo) lo = e.a; if (e.a > hi) hi = e.a; }
  return hi - lo >= REP_MIN ? [lo - REP_PAD, hi + REP_PAD] : null;
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

// MediaPipe's visibility of the knees and ankles sinks to about 0.4 at the bottom of a squat (seen on 8 recorded people,
// front view, whole body in frame) although they are in plain view and their positions stay good. Read as unsure, the
// legs froze and blended back to standing exactly at the deepest point. A joint whose image position is inside the
// picture is trusted as at least IN_FRAME_VIS while its own score is above IN_FRAME_MIN; legs out of the picture (a
// laptop camera at a desk) still read as unseen.
const IN_FRAME_MIN = 0.25, IN_FRAME_VIS = 0.8, IN_FRAME_PAD = 0.01;
/** visibility used for one joint: its own score, raised while its image position is inside the picture and the score is
 * at least `min` */
export function effVis(v, im, min = IN_FRAME_MIN) {
  if (v < min || !im) return v;
  const inside = im.x > IN_FRAME_PAD && im.x < 1 - IN_FRAME_PAD && im.y > IN_FRAME_PAD && im.y < 1 - IN_FRAME_PAD;
  return inside ? Math.max(v, IN_FRAME_VIS) : v;
}

/** one detection result into the filtered joints; mir = mirror view */
export function camIngest(cam, res, now, mir) {
  const w0 = res.worldLandmarks && res.worldLandmarks[0];
  cam.lm2d = (res.landmarks && res.landmarks[0]) || null;
  if (!w0) return;
  const wl = fuse2d(cam, w0, cam.lm2d);
  const t = now / 1000, dt = t - cam.tPrev, J = cam.J;
  const vis = i => effVis(wl[i].visibility == null ? 1 : wl[i].visibility, cam.lm2d && cam.lm2d[i]);
  let mv = 0, mvN = 0;
  const va = dt > 0 && dt < 0.5 ? 1 - Math.exp(-dt / VIS_T) : 1;
  const put = (name, i, track) => {
    const c0 = cam.Vis[name] == null ? vis(i) : cam.Vis[name], conf = c0 + (vis(i) - c0) * va;
    cam.Vis[name] = conf;
    if (vis(i) < 0.5) return;                                   // low confidence: keep the previous frame's value
    const p = wl[i], raw = rawOf(p, mir);
    if (cam.tune.guard) {                                       // a jump no body makes in this time: a glitch, held
      const r0 = cam.R[name], tr = cam.Tr[name], dr = tr == null ? 0 : t - tr, rv = cam.Rv[name] || V(0, 0, 0);
      if (r0 && dr > 0 && dr < STALE) {
        // measured from where the joint's own recent motion would have taken it, so a steady fast move is never cut
        const miss = len(sub(raw, add(r0, mul(rv, dr))));
        if (miss > GATE_D + (FAST_J.test(name) ? GATE_VF : GATE_V) * dr && (cam.Rej[name] ?? 0) < GATE_N) { cam.Rej[name] = (cam.Rej[name] ?? 0) + 1; return; }
        const v1 = mul(sub(raw, r0), 1 / dr), sp = len(v1), vc = sp > MAX_V * 2 ? mul(v1, MAX_V * 2 / sp) : v1;
        cam.Rv[name] = cam.Rej[name] ? vc : add(rv, mul(sub(vc, rv), RAW_VA));   // taken after being held: a real move, its speed as is
      } else cam.Rv[name] = V(0, 0, 0);
      cam.Rej[name] = 0;
    }
    cam.R[name] = raw; cam.Tr[name] = t;
    const kb = LEG_KB_J.test(name) ? LEG_KB : 1;
    const tn = cam.tune, f = cam.F[name] || (cam.F[name] = [oneEuro(tn, 1, kb), oneEuro(tn, 1, kb), oneEuro(tn, Z_KM, Z_KB * kb)]);
    const cs = 0.4 + 0.6 * clamp01((conf - 0.5) / 0.4);         // unsure joints are smoothed harder
    // MediaPipe world space is x → image right, y → down, z → away from the camera; ours is X = character's left, Y up, Z front.
    // Mirroring flips X and (below) swaps which side of the body feeds L / R, so the figure moves like a mirror image.
    const v = V(f[0](raw.x, t, cs), f[1](raw.y, t, cs), f[2](raw.z, t, cs));
    const tj = cam.Tj[name], dj = tj == null ? 0 : t - tj;
    if (dj > 0 && dj < STALE) {
      const raw = mul(sub(v, J[name]), 1 / dj), sp = len(raw), a = 1 - Math.exp(-TAU * VEL_CUT * dj);
      const lim = sp > MAX_V ? mul(raw, MAX_V / sp) : raw, old = cam.Vl[name] || V(0, 0, 0);
      cam.Vl[name] = add(old, mul(sub(lim, old), a));
      // coherence: the slow mean of the velocity vector against the slow mean of its length. Real motion keeps one
      // direction (ratio near 1); the landmarks' noise points every which way (ratio well below 1)
      const b = 1 - Math.exp(-dj / COH_T), m = cam.Vm[name] || V(0, 0, 0);
      cam.Vm[name] = add(m, mul(sub(lim, m), b));
      const s0 = cam.Vs[name] ?? 0;
      cam.Vs[name] = s0 + (Math.min(sp, MAX_V) - s0) * b;
    } else { cam.Vl[name] = V(0, 0, 0); cam.Vm[name] = V(0, 0, 0); cam.Vs[name] = 0; }
    cam.Tj[name] = t;
    if (track && dt > 0 && dt < 0.5) { mv += len(sub(v, J[name])) / dt; mvN++; }
    J[name] = v;
  };
  const idx = { nose: 0 };                                     // joint → landmark index
  for (const k in LM) for (const s of ['L', 'R']) idx[k + s] = LM[k] + ((s === 'R') !== mir ? 1 : 0);
  if (cam.tune.guard) unswap(cam, wl, idx, mir, vis);
  put('nose', 0);
  for (const k in LM) for (const s of ['L', 'R']) put(k + s, idx[k + s], k === 'el' || k === 'wr' || k === 'kn' || k === 'an');
  if (mvN) cam.motion += (mv / mvN - cam.motion) * 0.2;       // mean limb speed relative to the hips, m/s
  updateFrame(cam, dt > 0 && dt < 0.5 ? dt : 0);
  trackReps(cam, t);
  cam.tPrev = t; cam.fpsN++;
  if (vis(11) >= 0.5 && vis(12) >= 0.5) cam.seen = now;
}

/** left / right swapped back in idx, limb by limb, where the new landmarks fit the last accepted ones crossed over */
function unswap(cam, wl, idx, mir, vis) {
  for (const g of SWAP_GROUPS) {
    let st = 0, sw = 0, n = 0;
    for (const k of g) {
      const a = idx[k + 'L'], b = idx[k + 'R'], ra = cam.R[k + 'L'], rb = cam.R[k + 'R'];
      if (!ra || !rb || vis(a) < 0.5 || vis(b) < 0.5) continue;
      const pa = rawOf(wl[a], mir), pb = rawOf(wl[b], mir);
      st += len(sub(pa, ra)) + len(sub(pb, rb)); sw += len(sub(pa, rb)) + len(sub(pb, ra)); n++;
    }
    const key = g[0], c = cam.swapN[key] ?? 0;
    if (n && st > SWAP_MIN * n && sw < SWAP_K * st && c < SWAP_MAX) {
      for (const k of g) { const x = idx[k + 'L']; idx[k + 'L'] = idx[k + 'R']; idx[k + 'R'] = x; }
      cam.swapN[key] = c + 1;
    } else cam.swapN[key] = 0;
  }
}

/** the body frame from the hips and shoulders, low-passed, and a facing that ignores changes under FACE_DEAD */
function updateFrame(cam, dt) {
  const J = cam.J, pel = mul(add(J.hipL, J.hipR), 0.5), sh = mul(add(J.shL, J.shR), 0.5);
  const d = sub(sh, pel), up = len(d) > 1e-4 ? nrm(d) : UP;
  const sd = sub(J.shL, J.shR), sp = sub(sd, mul(up, dot(sd, up))), side = len(sp) > 1e-3 ? nrm(sp) : V(1, 0, 0);
  measureVertical(cam, dt);
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

/** the person's vertical (see LEVEL_T), low-passed into cam.vert; nothing while they bend */
function measureVertical(cam, dt) {
  const J = cam.J, V_ = cam.Vis, ok = k => (V_[k] ?? 0) >= 0.7;
  const sh = mul(add(J.shL, J.shR), 0.5);
  let v = null;
  if (['hip', 'kn', 'an'].every(k => ok(k + 'L') && ok(k + 'R'))) {
    const straight = n => dot(nrm(sub(J['kn' + n], J['hip' + n])), nrm(sub(J['an' + n], J['kn' + n]))) > LEG_STRAIGHT;
    if (straight('L') && straight('R')) v = sub(sh, mul(add(J.anL, J.anR), 0.5));
  } else if (!['kn', 'an'].some(k => ok(k + 'L') || ok(k + 'R')) && ok('shL') && ok('shR') && ok('hipL') && ok('hipR') && cam.motion < 0.3) {
    v = sub(sh, mul(add(J.hipL, J.hipR), 0.5));               // legs out of view: the trunk, while holding still
  }
  if (!v || len(v) < 0.2) return;
  v = nrm(v);
  if (v.y < LEVEL_MAX) return;
  if (!cam.vert || !dt) { cam.vert = v; return; }
  cam.vert = nrm(add(cam.vert, mul(sub(v, cam.vert), 1 - Math.exp(-dt / LEVEL_T))));
}

/** rotation taking the measured vertical to straight up (null = none), applied with levelOf(L, p) */
function levelRot(cam) {
  const v = cam.vert; if (!v) return null;
  const ax = cross(v, UP), s = len(ax), c = dot(v, UP);
  return s < 1e-4 ? null : { k: mul(ax, 1 / s), s, c };
}
const levelOf = (L, p) => {                                    // Rodrigues
  const { k, s, c } = L, kx = cross(k, p);
  return add(add(mul(p, c), mul(kx, s)), mul(k, dot(k, p) * (1 - c)));
};

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
    const ld = LEG_KB_J.test(k) ? lead * LEG_LEAD : lead;
    const h = tj == null || !vl || t - tj > STALE ? 0 : Math.min(MAX_H, Math.max(0, t - tj + ld));
    // only clearly moving, confidently seen joints are extrapolated: prediction would amplify the rest's noise
    const vm = cam.Vm[k] ? len(cam.Vm[k]) : 0, coh = (cam.Vs[k] ?? 0) > 1e-6 ? vm / cam.Vs[k] : 0;
    const g = h > 0 ? clamp01((Math.min(len(vl), vm) - V_REST) / (V_FULL - V_REST)) * clamp01(((cam.Vis[k] ?? 1) - 0.6) / 0.2) * clamp01((coh - COH_LO) / (COH_HI - COH_LO)) : 0;
    out[k] = g > 0 ? add(cam.J[k], V(vl.x * h * g, vl.y * h * g, vl.z * h * g * Z_PRED)) : cam.J[k];   // depth: see Z_PRED
  }
  // within the repetition range: a leg (or arm) whose predicted knee (elbow) angle leaves it is pulled back along its own path
  const kOf = (j, n) => {
    const r = repRange(cam, j, n, t); if (!r) return null;
    const a0 = bendAng(cam.J, j, n), a1 = bendAng(out, j, n), b = a1 < r[0] ? r[0] : a1 > r[1] ? r[1] : a1;
    return b === a1 || Math.abs(a1 - a0) < 1e-3 ? { k: 1, d: a1 - a0 } : { k: clamp01((b - a0) / (a1 - a0)), d: a1 - a0 };
  };
  const pull = (names, f) => { for (const j of names) out[j] = add(cam.J[j], mul(sub(out[j], cam.J[j]), f)); };
  const kl = kOf('kn', 'L'), kr = kOf('kn', 'R');
  if (kl && kl.k < 1) pull(LEG_J.map(j => j + 'L'), kl.k);
  if (kr && kr.k < 1) pull(LEG_J.map(j => j + 'R'), kr.k);
  if (kl && kr && kl.d * kr.d > 0 && Math.min(kl.k, kr.k) < 1) pull(TRUNK_J, Math.min(kl.k, kr.k));   // both knees together: a squat, the trunk too
  // arms (curls, presses): the elbow's own range; the elbow joint itself and the wrist move back together
  for (const n of ['L', 'R']) { const e = kOf('el', n); if (e && e.k < 1) pull(['el' + n, 'wr' + n], e.k); }
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
  const P = {}, D = {}, grip = { L: 0, R: 0 }, fingers = { L: null, R: null };
  const L = levelRot(cam);                                     // stand the person up straight (camera tilt removed)
  if (L) { const J2 = {}; for (const k in J) J2[k] = levelOf(L, J[k]); J = J2; }
  const camUp = cam.up && L ? levelOf(L, cam.up) : cam.up, camFace = cam.face && L ? levelOf(L, cam.face) : cam.face;
  const dir = (a, b, fb) => { const d = sub(b, a); return len(d) > 1e-4 ? nrm(d) : fb; };
  const perp = (v, n, fb) => { const p = sub(v, mul(n, dot(v, n))); return len(p) > 1e-3 ? nrm(p) : fb; };
  const shJ = mul(add(J.shL, J.shR), 0.5);
  // body frame: the smoothed one from camIngest (facing with a dead-band), or straight from the joints before the first frame
  const pelJ = mul(add(J.hipL, J.hipR), 0.5);
  const up = camUp || dir(pelJ, shJ, UP), side = perp(camFace || sub(J.shL, J.shR), up, V(1, 0, 0)), bodyF = cross(side, up);
  // lower body ('auto' / 'stand' leg modes): while the legs are not seen it stays standing upright (only the trunk above the waist follows the
  // person); as the legs come into view the pelvis takes the trunk's tilt again
  const lw = cam.tune.legs === 'normal' ? 1 : Math.min(legConf(cam, 'L'), legConf(cam, 'R'));
  const upL = lw >= 1 ? up : nlerp(UP, up, lw), sideL = perp(side, upL, V(1, 0, 0)), bodyFL = cross(sideL, upL);
  const hipAx = perp(dir(J.hipR, J.hipL, sideL), upL, sideL);
  P.pel = V(0, 0, 0); P.pelBot = mul(upL, 0.02); P.chest = mul(up, B.torso);
  for (const [n, s] of [['L', 1], ['R', -1]]) {
    const sh = add(P.chest, add(mul(side, s * B.shW), mul(up, -0.03)));
    const u = dir(J['sh' + n], J['el' + n], DOWN), lo = dir(J['el' + n], J['wr' + n], u);
    const el = add(sh, mul(u, B.ua)), wr = add(el, mul(lo, B.fa));
    P['sh' + n] = sh; P['el' + n] = el; P['wr' + n] = wr;
    // wrist roll: the tracked palm axis (hand tracking on and the hand just seen), else the body's facing
    const hs = cam.hands[n], ax = rollAxis(hs, lo, now);
    P['hand' + n] = add(wr, mul(lo, 0.1)); P['thumb' + n] = add(P['hand' + n], mul(ax || perp(bodyF, lo, up), 0.055));
    if (handLive(hs, now)) { grip[n] = hs.grip; fingers[n] = hs.curl; }
    const { tu, sl } = legDirs(J, n, s, upL, sideL, bodyFL, legConf(cam, n));
    const hip = mul(hipAx, s * B.hipW), kn = add(hip, mul(tu, B.thigh)), an = add(kn, mul(sl, B.shin));
    P['hip' + n] = hip; P['kn' + n] = kn; P['an' + n] = an;
    const fd = footDir(cam, J, n, bodyFL, nrm(add(bodyFL, mul(sideL, s * 0.15)))), sole = perp(DOWN, fd, BACK);
    P['heel' + n] = add(add(an, mul(fd, -0.042)), mul(sole, 0.058));
    P['toe' + n] = add(add(an, mul(fd, 0.15)), mul(sole, 0.066));
  }
  const earM = mul(add(J.earL, J.earR), 0.5), earAx = dir(J.earR, J.earL, side);
  const hf = perp(sub(J.nose, earM), earAx, bodyF), hu = cross(hf, earAx);
  P.head = add(P.chest, mul(nrm(add(mul(dir(shJ, earM, up), 0.6), mul(up, 0.4))), B.headUp));
  D.hu = hu; D.hf = hf; D.bodyF = bodyF; D.side = side; D.pelF = cross(hipAx, upL); D.pelU = upL;
  const minB = Math.min(P.heelL.y, P.toeL.y, P.heelR.y, P.toeR.y) - B.footR;      // world landmarks are hip-centred: stand the figure on the floor
  const lift = V(0, -settleGround(minB), 0);
  for (const k in P) P[k] = add(P[k], lift);
  return { P, D, prop: !!prop, grip, fingers, jump: 0 };
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
