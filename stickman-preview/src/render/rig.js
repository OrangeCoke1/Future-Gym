// Rest-pose skeletons and rigs: which bone(s) each rest point of a body follows, with blend weights across the joints.
import * as THREE from 'three';
import { B } from '../core/skeleton.js';
import { clamp, lerp } from '../core/math.js';
import { ANAT, SEG, trunkHalf } from './anatomy.js';

export const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
// rest skeleton, character frame: x = left, y = up, z = front, pelvis at the origin; arms hang slightly out (A-pose)
export const RJ = { pelBot: v3(0, 0.02, 0), chest: v3(0, B.torso, 0), head: v3(0, B.torso + B.headUp, 0) };
for (const [n, s] of [['L', 1], ['R', -1]]) {
  const sh = v3(s * B.shW, B.torso - 0.03, 0), ad = v3(s * 0.3, -1, 0).normalize();
  RJ['sh' + n] = sh; RJ['el' + n] = sh.clone().addScaledVector(ad, B.ua); RJ['wr' + n] = RJ['el' + n].clone().addScaledVector(ad, B.fa);
  RJ['hand' + n] = RJ['wr' + n].clone().addScaledVector(ad, 0.045);
  RJ['hip' + n] = v3(s * B.hipW, 0, 0); RJ['kn' + n] = v3(s * B.hipW, -B.thigh, 0); RJ['an' + n] = v3(s * B.hipW, -B.thigh - B.shin, 0);
  RJ['heel' + n] = RJ['an' + n].clone().add(v3(0, -0.04, -0.02)); RJ['toe' + n] = RJ['an' + n].clone().add(v3(0, -0.04, 0.13));
}
export const PARENT = [-1, 0, 0, 2, 3, 0, 5, 6, 0, 8, 9, 0, 11, 12];                 // SEG index -> parent bone
export const NEXT = [[1, 2, 5, 8, 11], [0], [0, 3], [2, 4], [3], [0, 6], [5, 7], [6], [0, 9], [8, 10], [9], [0, 12], [11, 13], [12]];
// rest-pose body as a signed distance (negative inside)
const capD = (p, a, b, ra, rb) => { const ba = b.clone().sub(a), h = clamp(p.clone().sub(a).dot(ba) / Math.max(ba.lengthSq(), 1e-9), 0, 1); return p.distanceTo(a.clone().addScaledVector(ba, h)) - lerp(ra, rb, h); };
const sminJ = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
export function bodyD(p) {                                 // same shape as the solid body's map() in the shader, rest pose
  const T = ANAT.trunk, yc = clamp(p.y, T[0][0], T[T.length - 1][0]), rx = trunkHalf(yc), rz = rx * ANAT.depth;
  let d = Math.max((Math.hypot(p.x / rx, p.z / rz) - 1) * rz, T[0][0] - p.y, p.y - T[T.length - 1][0]);   // trunk
  d = sminJ(d, capD(p, RJ.chest, v3(0, B.torso + ANAT.neck[2], 0), ANAT.neck[0], ANAT.neck[1]), 0.04);     // neck
  for (const n of ['L', 'R']) d = sminJ(d, capD(p, v3(0, B.torso + ANAT.trap[0], 0), RJ['sh' + n], ANAT.trap[1], ANAT.trap[2]), 0.04);   // trapezius
  const [hx, hy, hz] = ANAT.head, hq = v3(p.x, p.y - RJ.head.y, p.z - 0.01);
  const k0 = Math.hypot(hq.x / hx, hq.y / hy, hq.z / hz), k1 = Math.hypot(hq.x / (hx * hx), hq.y / (hy * hy), hq.z / (hz * hz));
  d = sminJ(d, k0 * (k0 - 1) / Math.max(k1, 1e-6), 0.03);                                                 // head
  for (const n of ['L', 'R']) {
    const sh = RJ['sh' + n], el = RJ['el' + n], wr = RJ['wr' + n];
    let arm = sminJ(capD(p, sh, el, ...ANAT.ua), capD(p, el, wr, ...ANAT.fa), 0.02);
    arm = sminJ(arm, capD(p, wr, wr.clone().add(wr.clone().sub(el).normalize().multiplyScalar(ANAT.hand[2])), ANAT.hand[0], ANAT.hand[1]), 0.02);
    d = sminJ(d, sminJ(arm, p.distanceTo(sh) - ANAT.delt, 0.03), 0.04);
    const kn = RJ['kn' + n], an = RJ['an' + n], c = p.clone().sub(kn).dot(an.clone().sub(kn).normalize());
    let leg = sminJ(capD(p, RJ['hip' + n], kn, ...ANAT.th), capD(p, kn, an, ...ANAT.sh) - ANAT.calf[0] * Math.exp(-Math.pow((c - ANAT.calf[1]) / ANAT.calf[2], 2)), 0.02);
    leg = sminJ(leg, capD(p, RJ['heel' + n], RJ['toe' + n], ...ANAT.foot), 0.03);
    d = sminJ(d, leg, 0.03);
  }
  return d;
}
// ---- rigs: a rest-pose skeleton plus "which bone does this rest point belong to" ----
// The trunk line is extended down through the hips and up to the neck so buttocks and neck belong to the trunk.
export function makeRig(J) {
  const restA = SEG.map(s => J[s[0]]), restB = SEG.map(s => J[s[1]]);
  const restDir = SEG.map((s, i) => restB[i].clone().sub(restA[i]).normalize());
  const skinA = restA.map((a, i) => i === 0 ? v3(J.pelBot.x, J.pelBot.y - 0.14, J.pelBot.z) : a);
  const skinB = restB.map((b, i) => i === 0 ? v3(J.chest.x, J.chest.y + 0.06, J.chest.z) : b);
  const boneDist = (p, i) => capD(p, skinA[i], skinB[i], 0, 0);
  // Weights blend across the JOINT: take the nearest bone, then the joint it shares with a neighbour that is closest
  // to the point, and fade from parent to child across a band around that joint, measured along the child's
  // direction. Hips and shoulders only start handing over below / outside the joint, and less so near the body's
  // midline (hips) or chest (shoulders), so the belly, crotch and chest stay with the trunk. Head pivots at the base
  // of the skull, feet at the ankle. The joint itself is stored too: blending rotates AROUND it (see blend()).
  const UPv = v3(0, 1, 0), neck = v3(J.chest.x, J.chest.y + 0.07, J.chest.z);
  const pivotOf = c => c === 1 ? neck : (c === 10 || c === 13) ? restB[PARENT[c]] : restA[c];
  const axisOf = c => c === 1 ? UPv : (c === 10 || c === 13) ? restDir[PARENT[c]] : restDir[c];
  // [start, end] of the band along the child's axis, then [from, to] of |x| over which the child's share fades in
  const bandOf = c => (c === 8 || c === 11) ? [-0.02, 0.12, 0.0, 0.025] : (c === 2 || c === 5) ? [0.0, 0.05, 0.1, 0.14] : [-0.05, 0.05, -1, 0];
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const armBone = { 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 };
  function skinOf(p, n) {                           // n: surface normal at p, if known (mesh vertices)
    let b1 = 0, d1 = 1e9;
    for (let i = 0; i < SEG.length; i++) { const d = boneDist(p, i); if (d < d1) { d1 = d; b1 = i; } }
    // Below the armpit the side of the chest and the inside of the upper arm touch in the A-pose, so distance cannot
    // tell them apart. The normal can: chest-side skin faces away from the body's midline, inner-arm skin faces it.
    const ax = Math.abs(p.x - J.chest.x), side = Math.sign(p.x - J.chest.x);
    if (armBone[b1] && p.y < J.shL.y - 0.03 && p.y > J.shL.y - 0.3 && (ax < 0.13 || (n && ax < 0.2 && n.x * side > 0.15))) b1 = 0;
    let b2 = b1, child = b1, dj = 1e9;
    for (const j of NEXT[b1]) { const c = PARENT[j] === b1 ? j : b1, d = p.distanceTo(pivotOf(c)); if (d < dj) { dj = d; b2 = j; child = c; } }
    if (b2 === b1) return [b1, b1, 0, b1];
    const [lo, hi, l0, l1] = bandOf(child);
    let wc = smooth(lo, hi, p.clone().sub(pivotOf(child)).dot(axisOf(child)));
    if (l0 >= 0) wc *= smooth(l0, l1, Math.abs(p.x - J.chest.x));
    const w = b2 === child ? wc : 1 - wc;
    return w > 0.5 ? [b2, b1, 1 - w, child] : [b1, b2, w, child];     // first bone = the one with the larger share
  }
  const zoneOf = (b, p) => b === 0 ? (p.y - J.pelBot.y < 0.16 * (J.chest.y - J.pelBot.y) / 0.34 ? 8 : 9) : (b in ZB ? ZB[b] : -1);
  return { J, restA, restB, restDir, skinOf, zoneOf, pivots: SEG.map((s, c) => pivotOf(c)) };
}
const ZB = { 8: 0, 11: 1, 9: 2, 12: 3, 2: 4, 5: 5, 3: 6, 6: 7 };
export const trunkH = y => { const t = clamp((y - 0.05) / 0.35, 0, 1); return t * t * (3 - 2 * t); };   // 0 at the hips, 1 at the chest

// ---- the human model (male_body.glb, "Male Body" by Alexander Antipov, CC BY 4.0) ----
// A static mesh (no bones) in an A-pose, Y up, centimetres, feet at y = 0, facing +Z. It is bound to our skeleton here:
// joint positions were measured on the mesh, every vertex follows its nearest bone (blending at joints), and per frame
// the vertices are moved on the CPU. If the file is missing, the procedural body above stays in use.
export const MESH_CM = 120;                                 // centimetres per world unit (180 cm tall -> 1.5 units)
const MJ = { pelBot: [0, 90.4, 0], chest: [0, 146.6, -1], head: [0, 168, 2], shL: [17, 143, -3], elL: [34, 117, -5], wrL: [46, 96, 7], handL: [50, 86, 13],
  hipL: [9.5, 88, 0], knL: [13, 50, -2], anL: [16, 9, -5], heelL: [16, 2, -10], toeL: [22, 1, 13] };
export const RM = {};
for (const [k, [x, y, z]] of Object.entries(MJ)) {
  RM[k] = v3(x / MESH_CM, (y - 88) / MESH_CM, z / MESH_CM);
  if (k.endsWith('L')) RM[k.slice(0, -1) + 'R'] = v3(-x / MESH_CM, (y - 88) / MESH_CM, z / MESH_CM);
}
