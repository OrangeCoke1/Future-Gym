// Per-frame bone transforms and skinning: poseBones() turns a solved skeleton into bone rotations, blend() moves one
// rest point (or normal) of a rig with them. One poser is shared by the solid mesh and the particle body.
import * as THREE from 'three';
import { sub, clamp } from '../core/math.js';
import { SEG } from './anatomy.js';
import { PARENT, trunkH } from './rig.js';

// Shoulder girdle: when the arm is raised the shoulder joint rises (see solve), and the top of the trunk around it
// (trapezius, deltoid cap, upper chest and back) has to come along or a notch opens above the shoulder. gDel is how far
// each shoulder joint sits from where the chest alone would put it; trunk points move by gDel times their girdle
// weight (signed: + left, − right), which is 1 at the shoulder and fades towards the neck, the midline and the waist.
export function girdleW(rig, x, y, z) {
  const sh = rig.J[x > 0 ? 'shL' : 'shR'], d = Math.hypot(x - sh.x, y - sh.y, z - sh.z);
  const a = clamp((d - 0.07) / 0.15, 0, 1), b = clamp((Math.abs(x) - 0.03) / 0.06, 0, 1);
  return (1 - a * a * (3 - 2 * a)) * b * b * (3 - 2 * b) * (x > 0 ? 1 : -1);
}

export function createPoser() {
  // ---- per-frame bone transforms ----
  // Every bone gets a rotation (quaternion) and the current position of its start joint, so a rest point p moves to
  // A_cur + q·(p − A_rest). The trunk twists: its rotation is interpolated per point between the pelvis frame (hip
  // height) and the chest frame (shoulder height), so shoulders and pelvis can turn against each other when walking.
  const boneQ = new Float32Array(SEG.length * 4), aR = SEG.map(() => new THREE.Vector3()), aC = SEG.map(() => new THREE.Vector3());
  const pivR = SEG.map(() => new THREE.Vector3()), pivC = SEG.map(() => new THREE.Vector3()), pivP = SEG.map(() => new THREE.Vector3());
  const qPel = new Float32Array(4), qChe = new Float32Array(4), q1 = new Float32Array(4), q2 = new Float32Array(4), tq = new Float32Array(4), tmp3 = new Float32Array(3);
  const R4 = SEG.map(() => new THREE.Matrix4()), pelM = new THREE.Matrix4();
  const _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _w = new THREE.Vector3(), _ax = new THREE.Vector3();
  const qset = (o, q) => { o[0] = q.x; o[1] = q.y; o[2] = q.z; o[3] = q.w; };
  function nlerpQ(o, a, b, w) {
    const s = (a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]) < 0 ? -w : w;
    const x = a[0] * (1 - w) + b[0] * s, y = a[1] * (1 - w) + b[1] * s, z = a[2] * (1 - w) + b[2] * s, ww = a[3] * (1 - w) + b[3] * s;
    const l = Math.hypot(x, y, z, ww) || 1; o[0] = x / l; o[1] = y / l; o[2] = z / l; o[3] = ww / l;
  }
  function qrot(q, x, y, z, out, o, ax, ay, az) {    // out = q·(x, y, z) + (ax, ay, az)
    const tx = 2 * (q[1] * z - q[2] * y), ty = 2 * (q[2] * x - q[0] * z), tz = 2 * (q[0] * y - q[1] * x);
    out[o] = x + q[3] * tx + (q[1] * tz - q[2] * ty) + ax; out[o + 1] = y + q[3] * ty + (q[2] * tx - q[0] * tz) + ay; out[o + 2] = z + q[3] * tz + (q[0] * ty - q[1] * tx) + az;
  }
  const gDel = new Float32Array(6); let gArr = null;
  function boneQof(o, b, h) { if (b === 0) nlerpQ(o, qPel, qChe, h); else { o[0] = boneQ[b * 4]; o[1] = boneQ[b * 4 + 1]; o[2] = boneQ[b * 4 + 2]; o[3] = boneQ[b * 4 + 3]; } }
  let posedRig = null;                                 // rig of the body posed this frame (dumbbells are put into its hands)
  // Grip point in the posed hand: a rest point in the palm moved with the forearm (the hand keeps the forearm's frame),
  // so the dumbbell sits in the model's hand; the handle runs front-to-back across the palm like in a neutral grip.
  function gripOf(n, pos, axis) {
    const rig = posedRig; if (!rig) return false;
    const b = n === 'L' ? 3 : 6, wr = rig.J['wr' + n], hd = rig.J['hand' + n], gp = rig.grip && rig.grip[n];
    const gx = gp ? gp.c.x : wr.x + (hd.x - wr.x) * 0.5, gy = gp ? gp.c.y : wr.y + (hd.y - wr.y) * 0.5, gz = gp ? gp.c.z : wr.z + (hd.z - wr.z) * 0.5;
    boneQof(q1, b, 0); qrot(q1, gx - aR[b].x, gy - aR[b].y, gz - aR[b].z, tmp3, 0, aC[b].x, aC[b].y, aC[b].z); pos.set(tmp3[0], tmp3[1], tmp3[2]);
    if (gp) { qrot(q1, gp.axis.x, gp.axis.y, gp.axis.z, tmp3, 0, 0, 0, 0); axis.set(tmp3[0], tmp3[1], tmp3[2]).normalize(); return true; }
    const dx = hd.x - wr.x, dy = hd.y - wr.y, dz = hd.z - wr.z, l2 = dx * dx + dy * dy + dz * dz || 1;
    qrot(q1, -dz * dx / l2, -dz * dy / l2, 1 - dz * dz / l2, tmp3, 0, 0, 0, 0); axis.set(tmp3[0], tmp3[1], tmp3[2]).normalize();
    return true;
  }
  function poseBones(rig, P, D) {
    posedRig = rig;
    const T = p => _v.set(p.x, p.y, p.z);
    const basisOf = (m, up, fw) => { const y = new THREE.Vector3(up.x, up.y, up.z).normalize(), z = new THREE.Vector3(fw.x, fw.y, fw.z); z.addScaledVector(y, -z.dot(y)).normalize(); m.makeBasis(new THREE.Vector3().crossVectors(y, z), y, z); };
    const up = sub(P.chest, P.pelBot);
    basisOf(R4[0], up, D.bodyF); _q.setFromRotationMatrix(R4[0]); qset(qChe, _q);
    basisOf(pelM, D.pelU || up, D.pelF || D.bodyF);   // pelvis upright when the camera does not see the legs _q.setFromRotationMatrix(pelM); qset(qPel, _q);
    basisOf(R4[1], D.hu, D.hf);
    for (let i = 2; i < SEG.length; i++) {           // limbs: shortest turn from where the parent frame would put the bone to where it is
      const pr = (i === 8 || i === 11) ? pelM : R4[PARENT[i]];               // legs hang from the pelvis, arms from the chest
      if (i === 4 || i === 7) { R4[i].copy(pr); continue; }              // hands keep the forearm's frame
      _ax.copy(rig.restDir[i]).applyMatrix4(pr).normalize();
      _w.copy(T(P[SEG[i][1]])).sub(T(P[SEG[i][0]]));
      if (_w.lengthSq() < 1e-10) { R4[i].copy(pr); continue; }
      _q.setFromUnitVectors(_ax, _w.normalize());
      R4[i].makeRotationFromQuaternion(_q).multiply(pr);
    }
    for (let i = 0; i < SEG.length; i++) {
      _q.setFromRotationMatrix(R4[i]); boneQ[i * 4] = _q.x; boneQ[i * 4 + 1] = _q.y; boneQ[i * 4 + 2] = _q.z; boneQ[i * 4 + 3] = _q.w;
      aR[i].copy(rig.restA[i]); aC[i].copy(T(P[SEG[i][0]]));
    }
    // each joint as moved by its child bone (pivC) and by its parent bone (pivP)
    for (let i = 0; i < SEG.length; i++) {
      const r = pivR[i].copy(rig.pivots[i]);
      boneQof(q1, i, trunkH(r.y)); qrot(q1, r.x - aR[i].x, r.y - aR[i].y, r.z - aR[i].z, tmp3, 0, aC[i].x, aC[i].y, aC[i].z); pivC[i].set(tmp3[0], tmp3[1], tmp3[2]);
      if (i === 0) continue;
      const pa = i === 1 ? 0 : PARENT[i];
      boneQof(q1, pa, trunkH(r.y)); qrot(q1, r.x - aR[pa].x, r.y - aR[pa].y, r.z - aR[pa].z, tmp3, 0, aC[pa].x, aC[pa].y, aC[pa].z); pivP[i].set(tmp3[0], tmp3[1], tmp3[2]);
    }
    for (const [b, o] of [[2, 0], [5, 3]]) {          // girdle offset of each shoulder (limited, camera poses can be noisy)
      const r = aR[b]; boneQof(q1, 0, trunkH(r.y)); qrot(q1, r.x - aR[0].x, r.y - aR[0].y, r.z - aR[0].z, tmp3, 0, aC[0].x, aC[0].y, aC[0].z);
      let dx = aC[b].x - tmp3[0], dy = aC[b].y - tmp3[1], dz = aC[b].z - tmp3[2]; const l = Math.hypot(dx, dy, dz), m = l > 0.07 ? 0.07 / l : 1;
      gDel[o] = dx * m; gDel[o + 1] = dy * m; gDel[o + 2] = dz * m;
    }
  }
  function addGirdle(k, i1, i2, w, out, o) {           // trunk share of a point follows the raised shoulder
    const g = gArr ? gArr[k] : 0; if (!g) return;
    const t = (i1 === 0 ? 1 - w : 0) + (i2 === 0 ? w : 0); if (!t) return;
    const s = g > 0 ? 0 : 3, f = Math.abs(g) * t;
    out[o] += gDel[s] * f; out[o + 1] += gDel[s + 1] * f; out[o + 2] += gDel[s + 2] * f;
  }
  // Move one rest point (x, y, z) into out[o..o+2]; withT = false rotates only (for normals). th = trunk height factor.
  // Two bones: interpolate their rotations and turn around the shared joint (placed by each bone and mixed with the same
  // weight), so a hip or shoulder bends like a ball joint instead of averaging two positions.
  function blend(k, b1, b2, w2, pv, th, x, y, z, out, o, withT) {
    const w = w2[k], i1 = b1[k], h = th[k];
    boneQof(q1, i1, h);
    if (!(w > 0)) {
      if (withT) { const r = aR[i1], c = aC[i1]; qrot(q1, x - r.x, y - r.y, z - r.z, out, o, c.x, c.y, c.z); addGirdle(k, i1, -1, 0, out, o); } else qrot(q1, x, y, z, out, o, 0, 0, 0);
      return;
    }
    const i2 = b2[k]; boneQof(q2, i2, h); nlerpQ(tq, q1, q2, w);
    if (!withT) { qrot(tq, x, y, z, out, o, 0, 0, 0); return; }
    const c = pv[k], r = pivR[c], p1 = i1 === c ? pivC[c] : pivP[c], p2 = i2 === c ? pivC[c] : pivP[c];
    qrot(tq, x - r.x, y - r.y, z - r.z, out, o, p1.x + (p2.x - p1.x) * w, p1.y + (p2.y - p1.y) * w, p1.z + (p2.z - p1.z) * w);
    addGirdle(k, i1, i2, w, out, o);
  }
  return {
    poseBones, blend, gripOf,
    /** girdle weights of the body skinned next (null = none) */
    setGirdle(arr) { gArr = arr; },
    /** forget this frame's posed rig (the dumbbells fall back to the skeleton's hand points) */
    clearPosed() { posedRig = null; }
  };
}
