import { clamp, TAU, C } from '../core/math.js';
import { font } from './chart.js';

/** @param {import('./chart.js').Chart} ch @param {number} hr @param {string} zone  translated heart-rate zone name */
export function drawHr(ch, hr, zone) {              // radial dial on the dark tile: 72 fine spokes, the lit ones show where 50–190 BPM the value sits
  const { g, w, h, d } = ch; g.clearRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - d, r0 = R * 0.6, n = 72;
  if (R < 10 * d) return;                             // not laid out yet
  const frac = clamp((hr - 50) / 140, 0, 1), litN = Math.max(1, Math.round(frac * n));
  g.lineCap = 'butt'; g.lineWidth = Math.max(1, 1.4 * d);
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + i / n * TAU, on = i < litN, r1 = on ? R : r0 + (R - r0) * 0.42;
    g.strokeStyle = on ? C.acc : C.off;
    g.beginPath(); g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); g.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); g.stroke();
  }
  g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.fillStyle = C.ivory;
  font(g, Math.round(r0 * 0.6), 500, 'Unbounded'); g.fillText(Math.round(hr), cx, cy + r0 * 0.14);
  font(g, Math.max(10 * d, r0 * 0.15)); g.fillText('BPM · ' + zone, cx, cy + r0 * 0.14 + Math.max(15 * d, r0 * 0.26));
}
