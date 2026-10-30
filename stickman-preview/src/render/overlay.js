// 2D overlay over the stage: the joint-angle arc with its number, and the optional keypoint dots.
import { clamp, TAU, C } from '../core/math.js';

const DOTS = ['head', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR'];

/**
 * @param {CanvasRenderingContext2D} g
 * @param {{ W: number, H: number, viewH: number, dpr: number, project: (p: import('../core/math.js').Vec3) => { x: number, y: number },
 *   P: import('../core/skeleton.js').Joints | null, show: string[] | null, curAngle: number | null, dark: boolean, angle: boolean, dots: boolean }} o
 *   show = the three joints of the shown angle; angle / dots = the 角度 / 关键点 display toggles; dark = dark stage
 */
export function drawOverlay(g, { W, H, viewH, dpr, project: scr, P, show, curAngle, dark, angle, dots }) {
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
  if (!P) return;
  const sc = H / viewH;
  if (angle && show && curAngle != null) {
    const a = scr(P[show[0]]), b = scr(P[show[1]]), c = scr(P[show[2]]);
    const a1 = Math.atan2(a.y - b.y, a.x - b.x), a2 = Math.atan2(c.y - b.y, c.x - b.x);
    let d = a2 - a1; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
    // a thin arc between the two bones and the number just outside it; a halo in the stage colour keeps both legible
    const r = 0.1 * sc, bgc = dark ? C.ink : '#E9E8D8';
    g.lineCap = 'round';
    g.strokeStyle = bgc; g.lineWidth = 5 * dpr; g.beginPath(); g.arc(b.x, b.y, r, a1, a1 + d, d < 0); g.stroke();
    g.strokeStyle = C.acc; g.lineWidth = 2 * dpr; g.beginPath(); g.arc(b.x, b.y, r, a1, a1 + d, d < 0); g.stroke();
    g.fillStyle = C.acc; g.beginPath(); g.arc(b.x, b.y, 2.5 * dpr, 0, TAU); g.fill();
    // the number goes past the arc on whichever side of the joint is farther from the trunk and head, so it never sits on the body
    const mid = a1 + d / 2, lr = r + 18 * dpr, hc = scr(P.chest), hp = scr(P.pelBot), hh = scr(P.head);
    const away = (x, y) => {
      const vx = hp.x - hc.x, vy = hp.y - hc.y, u = clamp(((x - hc.x) * vx + (y - hc.y) * vy) / (vx * vx + vy * vy || 1), 0, 1);
      return Math.min(Math.hypot(x - hc.x - vx * u, y - hc.y - vy * u), Math.hypot(x - hh.x, y - hh.y));
    };
    const sg = away(b.x + Math.cos(mid) * lr, b.y + Math.sin(mid) * lr) >= away(b.x - Math.cos(mid) * lr, b.y - Math.sin(mid) * lr) ? 1 : -1;
    const tx = b.x + sg * Math.cos(mid) * lr, ty = b.y + sg * Math.sin(mid) * lr;
    const txt = Math.round(curAngle) + '°';
    g.font = `500 ${Math.round(12 * dpr)}px Unbounded, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.strokeStyle = bgc; g.lineWidth = 4 * dpr; g.strokeText(txt, tx, ty);
    g.fillStyle = C.acc; g.fillText(txt, tx, ty);
  }
  if (dots) {
    g.fillStyle = C.ivory; g.strokeStyle = C.ink; g.lineWidth = 1.5 * dpr;
    for (const k of DOTS) {
      const p = scr(P[k]); g.beginPath(); g.arc(p.x, p.y, 4 * dpr, 0, TAU); g.fill(); g.stroke();
    }
  }
}
