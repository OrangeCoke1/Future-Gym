import { clamp, TAU, C } from '../core/math.js';

/**
 * @param {import('./chart.js').Chart} ch
 * @param {{ curAngle: number | null, curAngle2: number | null, th: [number, number] | undefined, dark: boolean }} o
 *   curAngle = tracked side, curAngle2 = the same joint on the other side, th = counting band of the rule, dark = dark stage
 */
export function drawAng(ch, { curAngle, curAngle2, th, dark }) {             // half-circle protractor, 0° left to 180° right: counting band in orange, needle = tracked side, ring = other side
  const { g, w, h, d } = ch; g.clearRect(0, 0, w, h);
  if (curAngle == null) return;
  const fgc = dark ? C.ivory : C.ink, bgc = dark ? C.ink : '#E9E8D8';    // it sits on the stage, which is dark in particle mode
  const R = Math.min(w / 2 - 4 * d, h - 6 * d), cx = w / 2, cy = h - 3 * d, T = a => Math.PI + clamp(a, 0, 180) / 180 * Math.PI;
  if (R < 12 * d) return;                             // canvas not laid out yet (or too small to draw)
  g.lineCap = 'butt';
  g.globalAlpha = 0.3; g.strokeStyle = fgc; g.lineWidth = d; g.beginPath(); g.arc(cx, cy, R, Math.PI, TAU); g.stroke();
  for (let a = 0; a <= 180; a += 15) { const t = T(a), l = (a % 90 === 0 ? 7 : 4) * d; g.beginPath(); g.moveTo(cx + Math.cos(t) * R, cy + Math.sin(t) * R); g.lineTo(cx + Math.cos(t) * (R - l), cy + Math.sin(t) * (R - l)); g.stroke(); }
  g.globalAlpha = 1;
  if (th) { g.strokeStyle = C.acc; g.lineWidth = 4 * d; g.beginPath(); g.arc(cx, cy, R - 2 * d, T(th[0]), T(th[1])); g.stroke(); }
  if (curAngle2 != null) { const t = T(curAngle2); g.strokeStyle = fgc; g.fillStyle = bgc; g.lineWidth = 1.5 * d; g.beginPath(); g.arc(cx + Math.cos(t) * (R - 2 * d), cy + Math.sin(t) * (R - 2 * d), 3.5 * d, 0, TAU); g.fill(); g.stroke(); }
  const t = T(curAngle);
  g.strokeStyle = fgc; g.lineWidth = 1.5 * d; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(t) * (R - 2 * d), cy + Math.sin(t) * (R - 2 * d)); g.stroke();
  g.fillStyle = fgc; g.beginPath(); g.arc(cx, cy, 3 * d, 0, TAU); g.fill();
}
