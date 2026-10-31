// Replay view, phase-synced: for exercises counted by one joint angle (squat, curl, press, lateral raise) the person's
// live angle picks the point of the scripted repetition to show, so the figure squats while the person squats
// instead of playing the rep after it has been counted. Other exercises keep the rep-queued replay.
import { solve, angle3, ground } from '../core/skeleton.js';
import { ACT } from '../core/actions.js';

const N = 96;                                         // samples over one scripted cycle
const MIN_RANGE = 10;                                 // degrees; a flatter curve is not worth syncing to
const flip = k => k.slice(0, -1) + (k.endsWith('L') ? 'R' : 'L');

/** @typedef {{ t: number[], u: number[], a0: number, a1: number }} PhaseTable
 *   scripted time t over the first half of a rep (rest → peak), u = progress 0..1 at each t (monotone), a0 / a1 = angle at rest / peak */
/** @type {Record<string, PhaseTable | null>} */
const cache = {};

/** mean of the left and right angle of the shown joints (the person may favour one side; the two sides agree in the script) */
export function bothSides(P, show) {
  const a = angle3(P[show[0]], P[show[1]], P[show[2]]), b = angle3(P[flip(show[0])], P[flip(show[1])], P[flip(show[2])]);
  return (a + b) / 2;
}

/** @param {string} k action key @returns {PhaseTable | null} null when the action cannot be phase-synced */
export function phaseTable(k) {
  if (k in cache) return cache[k];
  const A = ACT[k];
  if (!A || A.rep.type !== 'angle' || !Array.isArray(A.show)) return (cache[k] = null);
  const sm = ground.sm, gk = ground.k;                // solve() moves the shared ground smoothing: keep it as it was
  const ts = [], as = [];
  for (let i = 0; i < N; i++) { const t = A.P * i / N; ts.push(t); as.push(bothSides(solve(A.pose(t, A.P)).P, A.show)); }
  ground.sm = sm; ground.k = gk;
  let pk = 0;
  for (let i = 1; i < N; i++) if (Math.abs(as[i] - as[0]) > Math.abs(as[pk] - as[0])) pk = i;
  const a0 = as[0], a1 = as[pk];
  if (Math.abs(a1 - a0) < MIN_RANGE) return (cache[k] = null);
  const t = [], u = [];
  for (let i = 0; i <= pk; i++) {
    const p = Math.min(1, Math.max(0, (as[i] - a0) / (a1 - a0)));
    t.push(ts[i]); u.push(i ? Math.max(u[i - 1], p) : 0);      // monotone envelope, so every angle maps to one time
  }
  return (cache[k] = { t, u, a0, a1 });
}

/** scripted time that shows the given live angle (degrees) @param {PhaseTable} tab @param {number} ang @returns {number} */
export function phaseAt(tab, ang) {
  const { t, u } = tab, n = t.length, p = (ang - tab.a0) / (tab.a1 - tab.a0);
  if (!(p > 0)) return t[0];
  if (p >= 1) return t[n - 1];
  for (let i = 1; i < n; i++) {
    if (u[i] >= p) { const d = u[i] - u[i - 1]; return t[i - 1] + (t[i] - t[i - 1]) * (d > 0 ? (p - u[i - 1]) / d : 0); }
  }
  return t[n - 1];
}
