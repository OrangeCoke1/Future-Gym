import { clamp } from '../core/math.js';
import { v3, MESH_CM } from './rig.js';

// ---- gripping hands ----
// The model's hands are open and have no finger bones, so a fist is made in the rest pose: in a frame on each hand
// (s along the hand, h towards the palm, w across it, thumb at -w; numbers measured on the mesh, in cm) the fingers
// beyond the knuckles are wrapped around a cylinder (the dumbbell handle) and the thumb swings in over it. The
// curled rest shape is then skinned like the open one; gripK blends between the two.
export function makeFist(rig) {
  const cm = 1 / MESH_CM, sK = 11 * cm, hK = -1.5 * cm, Rc = 2.9 * cm, F = {};
  for (const [n, side] of [['L', 1], ['R', -1]]) {
    const wr = rig.J['wr' + n], hd = rig.J['hand' + n];
    const es = v3(hd.x - wr.x, hd.y - wr.y, hd.z - wr.z).normalize();
    const en = v3(-side, 0, 0); en.addScaledVector(es, -en.dot(es)).normalize();     // palm faces the thigh
    const ew = v3(0, 0, 0).crossVectors(es, en).multiplyScalar(side);
    F[n] = { side, wr, es, en, ew, C: v3(wr.x, wr.y, wr.z).addScaledVector(es, sK).addScaledVector(en, hK + Rc) };
  }
  const r = v3(0, 0, 0);
  // returns false if the point is not on a hand; otherwise writes the curled position (and normal) into op / on
  function curl(x, y, z, nx, ny, nz, op, on) {
    const f = x > 0 ? F.L : F.R;
    if (Math.abs(x) < 38 * cm) return false;
    r.set(x - f.wr.x, y - f.wr.y, z - f.wr.z);
    let s = r.dot(f.es), h = r.dot(f.en), w = r.dot(f.ew);
    if (s < -2 * cm || s > 25 * cm || Math.abs(w) > 11 * cm) return false;
    let ns = nx * f.es.x + ny * f.es.y + nz * f.es.z, nh = nx * f.en.x + ny * f.en.y + nz * f.en.z, nw = nx * f.ew.x + ny * f.ew.y + nz * f.ew.z;
    const tw = clamp((-w / cm - 5) / 1.5, 0, 1) * clamp((s / cm - 3) / 3, 0, 1) * (s < 11.5 * cm ? 1 : 0);
    if (tw > 0) {                                    // thumb: swing across the palm, over the handle
      const a = 0.85 * tw, c = Math.cos(a), si = Math.sin(a), ds = s - 3 * cm, dw = w + 7 * cm;
      s = 3 * cm + ds * c - dw * si; w = -7 * cm + ds * si + dw * c; h += 1.2 * cm * tw;
      const n1 = ns * c - nw * si; nw = ns * si + nw * c; ns = n1;
    } else if (s > sK) {                             // fingers: wrap around the handle
      let ph = (s - sK) / Rc, ext = 0;
      if (ph > 3.3) { ext = (ph - 3.3) * Rc; ph = 3.3; }
      const c = Math.cos(ph), si = Math.sin(ph), rho = Rc - (h - hK);
      s = sK + rho * si + ext * c; h = hK + Rc - rho * c + ext * si;
      const n1 = ns * c - nh * si; nh = ns * si + nh * c; ns = n1;
    } else return false;
    op[0] = f.wr.x + f.es.x * s + f.en.x * h + f.ew.x * w; op[1] = f.wr.y + f.es.y * s + f.en.y * h + f.ew.y * w; op[2] = f.wr.z + f.es.z * s + f.en.z * h + f.ew.z * w;
    if (on) { on[0] = f.es.x * ns + f.en.x * nh + f.ew.x * nw; on[1] = f.es.y * ns + f.en.y * nh + f.ew.y * nw; on[2] = f.es.z * ns + f.en.z * nh + f.ew.z * nw; }
    return true;
  }
  rig.grip = { L: { c: F.L.C, axis: F.L.ew }, R: { c: F.R.C, axis: F.R.ew } };
  // fist data for an array of rest points (and optional normals): which points move, and their open / curled values
  return (rest, nrest, use) => {
    const idx = [], open = [], fist = [], op = [0, 0, 0], on = [0, 0, 0];
    for (let i = 0; i < rest.length / 3; i++) {
      if (use && !use(i)) continue;
      const o = i * 3, nx = nrest ? nrest[o] : 0, ny = nrest ? nrest[o + 1] : 0, nz = nrest ? nrest[o + 2] : 0;
      if (!curl(rest[o], rest[o + 1], rest[o + 2], nx, ny, nz, op, on)) continue;
      idx.push(i); open.push(rest[o], rest[o + 1], rest[o + 2], nx, ny, nz); fist.push(op[0], op[1], op[2], on[0], on[1], on[2]);
    }
    return { idx: Int32Array.from(idx), open: new Float32Array(open), fist: new Float32Array(fist), k: 0 };
  };
}
/** blend the hand points between open and curled; g = grip amount 0 (open) – 1 (fist) */
export function applyFist(fd, rest, nrest, g) {
  if (!fd || Math.abs(fd.k - g) < 1e-3) return;
  fd.k = g; const { idx, open, fist } = fd;
  for (let j = 0; j < idx.length; j++) {
    const o = idx[j] * 3, q = j * 6;
    for (let e = 0; e < 3; e++) { rest[o + e] = open[q + e] + (fist[q + e] - open[q + e]) * g; if (nrest) nrest[o + e] = open[q + 3 + e] + (fist[q + 3 + e] - open[q + 3 + e]) * g; }
  }
}
