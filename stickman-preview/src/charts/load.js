import { V, sub, dot, nrm, clamp, TAU, C } from '../core/math.js';
import { kneeA } from '../core/actions.js';
import { IMPACT } from '../sim/load.js';

/**
 * side view of the live posture; dots at lumbar, hip and knee grow with their load
 * @param {import('./chart.js').Chart} ch
 * @param {{ P: import('../core/skeleton.js').Joints, D: import('../core/skeleton.js').Frames, run: boolean, action: string, load: import('../sim/load.js').LoadState }} o
 */
export function drawLoad(ch, { P, D, run, action, load }) {
  const { g, w, h, d } = ch; g.clearRect(0, 0, w, h);
  if (h < 22 * d) return;
  // Fixed scale and a pelvis-anchored origin, and always both legs: nothing here may depend on which leg is
  // more bent or on the pose's bounding box, or the drawing jumps on every stride.
  const fz = nrm(V(D.bodyF.x, 0, D.bodyF.z)), pad = 9 * d;
  const sc = Math.min((h - pad) / 1.6, (w - 2 * pad) / 1.5), ox = w / 2 - 0.06 * sc;
  const S = p => [ox + dot(sub(p, P.pel), fz) * sc, h - pad / 2 - p.y * sc];
  const line = pts => { g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); };
  const head = S(P.head), chest = S(P.chest), pel = S(P.pel), leg = n => [pel, S(P['kn' + n]), S(P['an' + n]), S(P['toe' + n])];
  const legL = leg('L'), legR = leg('R');
  // line, head and joint dots are sized from the drawing scale (not fixed pixels) so a small card is not swamped
  g.strokeStyle = C.ivory; g.lineWidth = clamp(sc * 0.016, 1.2 * d, 2.5 * d); g.lineJoin = g.lineCap = 'round';
  g.globalAlpha = 0.5; line(legR); g.globalAlpha = 1; line(legL); line([chest, pel]);
  g.fillStyle = C.ivory; g.beginPath(); g.arc(head[0], head[1], clamp(sc * 0.045, 2 * d, 5 * d), 0, TAU); g.fill();
  const lum = [pel[0] + (chest[0] - pel[0]) * 0.3, pel[1] + (chest[1] - pel[1]) * 0.3];
  // each knee's dot follows that knee's own bend (same formula as the read-out, which reports the more loaded one)
  const imp = run ? (IMPACT[action] || 0) : 0, kneeLoad = n => 0.5 + 3.0 * Math.pow(Math.sin((180 - kneeA(P, n)) * Math.PI / 360), 2) + imp;
  const dotAt = (p, v, a) => { g.globalAlpha = a; g.beginPath(); g.arc(p[0], p[1], clamp(sc * (0.012 + 0.0075 * clamp(v, 0, 5)), 1.5 * d, 7 * d), 0, TAU); g.fill(); };
  g.fillStyle = C.ink;
  dotAt(legR[1], kneeLoad('R'), 0.5); dotAt(legL[1], kneeLoad('L'), 1); dotAt(lum, load.spine, 1); dotAt(pel, load.hip, 1);
  g.globalAlpha = 1;
}
