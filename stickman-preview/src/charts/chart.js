// A chart = one 2D canvas sized in device pixels: { c, g, w, h, d } (canvas, context, width, height, pixel ratio).

/** @typedef {{ c: HTMLCanvasElement, g: CanvasRenderingContext2D, w: number, h: number, d: number }} Chart */

/** @param {HTMLCanvasElement} c @returns {Chart} */
export const chartOf = c => ({ c, g: c.getContext('2d'), w: 1, h: 1, d: 1 });
/** match the canvas to its laid-out size (pixel ratio capped at 2) */
export function sizeChart(ch) {
  const d = Math.min(window.devicePixelRatio || 1, 2), r = ch.c.getBoundingClientRect();
  ch.w = ch.c.width = Math.max(1, Math.round(r.width * d)); ch.h = ch.c.height = Math.max(1, Math.round(r.height * d)); ch.d = d;
}
export function font(g, size, w = 400, fam = 'Inter') { g.font = `${w} ${size}px ${fam}, "Noto Sans SC", sans-serif`; }
