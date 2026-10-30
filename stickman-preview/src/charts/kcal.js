import { C } from '../core/math.js';

/** @param {import("./chart.js").Chart} ch @param {number[]} slots  kcal per 2 s slot, oldest first */
export function drawKcal(ch, slots) {            // one fine line per 2 s slot, newest on the right in the accent colour
  const { g, w, h, d } = ch; g.clearRect(0, 0, w, h);
  const n = slots.length, lw = Math.max(1, 1.5 * d), max = Math.max(0.12, ...slots);
  for (let i = 0; i < n; i++) {
    const x = Math.round(lw / 2 + (w - lw) * i / (n - 1)), fh = Math.max(3 * d, h * slots[i] / max);
    g.fillStyle = i === n - 1 ? C.acc : slots[i] > 0 ? C.ink : C.inkOff;
    g.fillRect(x - lw / 2, h - fh, lw, fh);
  }
}
