// Hands: MediaPipe Hand Landmarker (21 points per hand) on the same camera frames as the pose, while 面板 → 手部识别 is
// on. Each detected hand is matched to the person's left or right wrist, then mirrored like the body. What the figure
// can show: the model has no finger bones, so a hand drives its grip (open ↔ fist) and its wrist roll; the fingers
// themselves are drawn in the camera window, and a few gestures are named.
import { V, sub, len, nrm, add, mul, dot, TAU, C } from '../core/math.js';

/** finger connections between the 21 hand landmarks (0 = wrist; thumb 1–4, index 5–8, middle 9–12, ring 13–16, pinky 17–20) */
export const HAND_BONES = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]];
const HELD = 300;                                     // ms a hand's grip and roll are kept after it was last seen

/** @typedef {import('../core/math.js').Vec3} Vec3 */
/** @typedef {{ lm2d: {x: number, y: number}[] | null, grip: number, across: Vec3 | null, gesture: string | null, seen: number }} HandState
 *   lm2d = image landmarks (0..1), grip 0 open – 1 fist (smoothed), across = palm axis from the pinky to the index knuckle in
 *   figure space (sets the wrist roll), gesture = Chinese label or null, seen = last detection (ms) */
const hand = () => ({ lm2d: null, grip: 0, across: null, gesture: null, seen: -1e9 });
/** @returns {{ L: HandState, R: HandState }} keyed by the figure's side */
export const createHands = () => ({ L: hand(), R: hand() });
export function resetHands(H) { Object.assign(H.L, hand()); Object.assign(H.R, hand()); }
/** is this hand fresh enough to drive the figure */
export const handLive = (h, now) => !!h && now - h.seen < HELD;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/** grip 0 (open) – 1 (fist): fingertips' distance to the wrist relative to their knuckles' (≈ 2 open, ≈ 1 curled) */
export function gripOf(w) {
  let r = 0;
  for (const [tip, mcp] of [[8, 5], [12, 9], [16, 13], [20, 17]]) r += dist(w[tip], w[0]) / Math.max(1e-4, dist(w[mcp], w[0]));
  return Math.min(1, Math.max(0, (1.85 - r / 4) / 0.8));
}

/** which fingers are straight: [thumb, index, middle, ring, pinky] */
export function extendedOf(w) {
  const f = [[8, 6], [12, 10], [16, 14], [20, 18]].map(([tip, pip]) => dist(w[tip], w[0]) > dist(w[pip], w[0]) * 1.12);
  const thumb = dist(w[4], w[17]) > dist(w[2], w[17]) * 1.25 && dist(w[4], w[5]) > dist(w[3], w[5]) * 1.05;
  return [thumb, ...f];
}

/** a few gestures, as Chinese labels (the UI translates them); up = the thumb tip is above the wrist in the image */
export function gestureOf(w, l2) {
  const [t, i, m, r, p] = extendedOf(w), n = [i, m, r, p].filter(Boolean).length;
  if (!t && n === 0) return '握拳';
  if (n === 4 && t) return '张开';
  if (i && m && !r && !p) return '比 V';
  if (t && n === 0 && l2 && l2[4].y < l2[0].y - 0.04) return '点赞';
  if (i && !m && !r && !p) return '指';
  return null;
}

/**
 * one Hand Landmarker result into the per-side hand state
 * @param {{ L: HandState, R: HandState }} H @param {object} res @param {{x: number, y: number}[] | null} pose2d the pose's
 *   image landmarks (wrists 15 / 16 decide which hand is which) @param {number} now ms @param {boolean} mir mirror view
 */
export function ingestHands(H, res, pose2d, now, mir) {
  const L2 = res.landmarks || [], W = res.worldLandmarks || [], HD = res.handedness || [];
  const used = {};
  for (let i = 0; i < L2.length; i++) {
    const l2 = L2[i], w = W[i];
    if (!l2 || !w) continue;
    let person;                                       // the person's own side
    if (pose2d && pose2d[15] && pose2d[16]) {
      const d = k => Math.hypot(l2[0].x - pose2d[k].x, l2[0].y - pose2d[k].y);
      person = d(15) <= d(16) ? 'L' : 'R';
    } else {                                          // MediaPipe labels assume a mirrored (selfie) image; ours is not mirrored
      const lab = HD[i] && HD[i][0] && HD[i][0].categoryName;
      person = lab === 'Left' ? 'R' : 'L';
    }
    const n = mir ? (person === 'L' ? 'R' : 'L') : person;
    if (used[n]) continue;                            // two detections on one wrist: keep the first (higher score)
    used[n] = true;
    const h = H[n], dt = Math.max(0, now - h.seen) / 1000, a = h.seen < 0 || dt > 0.5 ? 1 : 1 - Math.exp(-dt / 0.08);
    h.grip += (gripOf(w) - h.grip) * a;
    // palm axis, MediaPipe camera space (x right, y down, z away) → figure space (X = character's left, Y up, Z front)
    const ac = sub(V(mir ? -w[5].x : w[5].x, -w[5].y, -w[5].z), V(mir ? -w[17].x : w[17].x, -w[17].y, -w[17].z));
    if (len(ac) > 1e-4) h.across = h.across && a < 1 ? nrm(add(h.across, mul(sub(nrm(ac), h.across), a))) : nrm(ac);
    h.lm2d = l2; h.gesture = gestureOf(w, l2); h.seen = now;
  }
  for (const n of ['L', 'R']) if (!used[n]) { H[n].lm2d = null; if (now - H[n].seen > HELD) H[n].gesture = null; }
}

/** palm axis usable for the wrist roll: perpendicular to the forearm `lo`, or null */
export function rollAxis(h, lo, now) {
  if (!handLive(h, now) || !h.across) return null;
  const p = sub(h.across, mul(lo, dot(h.across, lo)));
  return len(p) > 0.2 ? nrm(p) : null;
}

/** finger skeletons over the camera window's check view (same image coordinates as the pose) */
export function drawHands(g, H) {
  const c = g.canvas, w = c.width, h = c.height, k = w / 336;
  for (const n of ['L', 'R']) {
    const l = H[n].lm2d;
    if (!l) continue;
    g.lineWidth = 2 * k; g.lineCap = 'round'; g.strokeStyle = C.ivory;
    for (const [a, b] of HAND_BONES) { g.beginPath(); g.moveTo(l[a].x * w, l[a].y * h); g.lineTo(l[b].x * w, l[b].y * h); g.stroke(); }
    g.fillStyle = C.acc;
    for (let i = 0; i < 21; i++) { g.beginPath(); g.arc(l[i].x * w, l[i].y * h, (i % 4 === 0 ? 3 : 2) * k, 0, TAU); g.fill(); }
  }
}

/** the Hand Landmarker (2 hands), GPU if possible; wasm and model from public/mediapipe/ like the pose */
export async function loadHandLandmarker() {
  const v = await import('@mediapipe/tasks-vision');
  const root = import.meta.env.BASE_URL + 'mediapipe/';
  const files = await v.FilesetResolver.forVisionTasks(root + 'wasm');
  const make = delegate => v.HandLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: root + 'hand_landmarker.task', delegate }, runningMode: 'VIDEO', numHands: 2,
    minHandDetectionConfidence: 0.5, minHandPresenceConfidence: 0.5, minTrackingConfidence: 0.5 });
  try { return await make('GPU'); } catch { return await make('CPU'); }
}
