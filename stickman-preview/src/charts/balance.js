import { V, add, sub, mul, dot, nrm, TAU, C } from '../core/math.js';

/**
 * top view, body facing up: both feet (a lifted one faded) and the centre-of-mass drop point
 * @param {import('./chart.js').Chart} ch
 * @param {{ P: import('../core/skeleton.js').Joints, D: import('../core/skeleton.js').Frames } & ReturnType<import('../sim/balance.js').balanceOf>} o
 */
export function drawBal(ch, { P, D, com, upL, upR }) {
  const { g, w, h, d } = ch; g.clearRect(0, 0, w, h);
  const flatN = v => nrm(V(v.x, 0, v.z)), sx = flatN(D.side), fz = flatN(D.bodyF);
  const mid = mul(add(P.anL, P.anR), 0.5), sc = Math.min(w / 1.1, h / 0.62), cx = w / 2, cy = h * 0.56;
  const pt = p => { const r = sub(p, mid); return [cx - dot(r, sx) * sc, cy - dot(r, fz) * sc]; };      // character's left on the left
  g.strokeStyle = C.inkOff; g.lineWidth = d; g.setLineDash([2 * d, 4 * d]);
  g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, h); g.stroke(); g.setLineDash([]);
  g.lineCap = 'round'; g.lineWidth = Math.max(6 * d, 0.075 * sc); g.strokeStyle = C.ink;
  for (const [n, up] of [['L', upL], ['R', upR]]) {
    const a = pt(P['heel' + n]), b = pt(P['toe' + n]);
    g.globalAlpha = up ? 0.28 : 1; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
  }
  g.globalAlpha = 1;
  const c = pt(com);
  g.fillStyle = C.acc; g.beginPath(); g.arc(c[0], c[1], 5 * d, 0, TAU); g.fill();
  g.strokeStyle = C.acc; g.lineWidth = d; g.beginPath(); g.arc(c[0], c[1], 10 * d, 0, TAU); g.stroke();
}
