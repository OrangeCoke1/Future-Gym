import { clamp, TAU, C } from '../core/math.js';

/** heart rate over the last 30 s, one value per second; falls back to the current value until the first sample */
export function drawTrend(ch, trend, hr) {
  const { g, w, h, d } = ch; g.clearRect(0, 0, w, h);
  const pad = 4 * d, t = trend.length ? trend : [hr], off = 30 - t.length;
  const lo = 50, hi = 190, X = i => pad + (w - 2 * pad) * (t.length < 2 ? 1 : i / 29), Y = v => pad + (h - 2 * pad) * (1 - (clamp(v, lo, hi) - lo) / (hi - lo));
  g.strokeStyle = C.off; g.lineWidth = d;
  g.beginPath(); g.moveTo(0, h - d / 2); g.lineTo(w, h - d / 2); g.stroke();
  g.strokeStyle = C.ivory; g.lineWidth = 1.5 * d; g.lineJoin = g.lineCap = 'round';
  g.beginPath(); t.forEach((v, i) => { const x = X(i + off), y = Y(v); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  g.fillStyle = C.acc; g.beginPath(); g.arc(X(t.length - 1 + off), Y(t[t.length - 1]), 3 * d, 0, TAU); g.fill();
}
