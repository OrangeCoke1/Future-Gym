// Rigged human models (Mixamo skeletons: Xbot, Michelle), driven by the solved skeleton. Unlike male_body.glb these
// files carry their own bones and skin weights, so the mesh bends the way its artist weighted it and every finger has
// three bones. Per frame each bone gets a world rotation from our skeleton (P, D) — trunk and head from the body
// frames, limbs by the shortest turn onto our bone directions, hands from the wrist → palm direction and the thumb
// side, fingers curled by the grip (or per finger from hand tracking) — then the mesh is skinned on the CPU with the
// file's weights. The model keeps its own proportions (scaled to our figure's height and stood on the skeleton's
// soles), so its joints sit near, not on, the skeleton's: mapP() gives the overlay the model's joints instead. It also
// builds its own particle body (points on the mesh surface, blood vessels along the bones, the heart).
import * as THREE from 'three';
import { B } from '../core/skeleton.js';
import { lerp } from '../core/math.js';
import { RJ } from './rig.js';
import { ANAT } from './anatomy.js';
import { parseSkinnedGlb } from './glbSkin.js';

const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'];
const CURL = [[0.55, 0.5, 0.7], [1.45, 1.6, 1.1], [1.45, 1.6, 1.1], [1.45, 1.6, 1.1], [1.4, 1.55, 1.05]];   // rad at a full fist, per segment
const NEED = ['Hips', 'Spine2', 'Head', ...['Left', 'Right'].flatMap(s => ['Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot'].map(b => s + b))];

/** joint name without its namespace ("mixamorig:LeftArm" → "LeftArm") */
const bare = n => n.slice(n.lastIndexOf(':') + 1);

/**
 * what each joint does, by its Mixamo name
 * @returns {{ role: string, n?: 'L' | 'R', a?: string, b?: string, child?: string, f?: number, k?: number, t?: number } | null}
 */
function roleOf(name) {
  const R = { Hips: { role: 'pel' }, Spine: { role: 'spine', t: 1 / 3 }, Spine1: { role: 'spine', t: 2 / 3 }, Spine2: { role: 'chest' }, Neck: { role: 'neck' }, Head: { role: 'head' } };
  if (R[name]) return R[name];
  const m = /^(Left|Right)(.*)$/.exec(name);
  if (!m) return null;
  const S = m[1], n = S === 'Left' ? 'L' : 'R', rest = m[2];
  const limb = { Arm: ['sh', 'el', 'ForeArm'], ForeArm: ['el', 'wr', 'Hand'], UpLeg: ['hip', 'kn', 'Leg'], Leg: ['kn', 'an', 'Foot'] }[rest];
  if (limb) return { role: 'limb', n, a: limb[0] + n, b: limb[1] + n, child: S + limb[2] };
  if (rest === 'Shoulder') return { role: 'clav', n };
  if (rest === 'Hand') return { role: 'hand', n };
  if (rest === 'Foot') return { role: 'foot', n };
  const fm = /^Hand(Thumb|Index|Middle|Ring|Pinky)([1-3])$/.exec(rest);
  if (fm) return { role: 'finger', n, f: FINGERS.indexOf(fm[1]), k: Number(fm[2]) };
  return null;
}

/**
 * @param {{ scene: THREE.Scene, meshMat: THREE.Material, lineMat: THREE.Material, particles: ReturnType<import('./particles.js').createParticles>, PU: object }} o
 */
export function createRiggedModel({ scene, meshMat, lineMat, particles, PU }) {
  let M = null;                      // loaded model state
  let solid = null, solidLine = null;

  async function load(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    build(parseSkinnedGlb(buf));
  }

  function build(g) {
    const names = g.names.map(bare), NJ = names.length, at = {};
    names.forEach((nm, j) => { if (!(nm in at)) at[nm] = j; });
    for (const k of NEED) if (!(k in at)) throw new Error('rigged model: no joint ' + k);
    // scale: as tall as our figure; origin: the hip joints' midpoint; facing +Z with the character's left at +X
    const R0 = j => new THREE.Vector3(g.rest[j * 3], g.rest[j * 3 + 1], g.rest[j * 3 + 2]);
    let y0 = 1e9, y1 = -1e9; for (let i = 1; i < g.pos.length; i += 3) { y0 = Math.min(y0, g.pos[i]); y1 = Math.max(y1, g.pos[i]); }
    const sc = (RJ.head.y + ANAT.head[1] - (RJ.heelL.y - B.footR)) / (y1 - y0);
    const o = R0(at.LeftUpLeg).add(R0(at.RightUpLeg)).multiplyScalar(0.5);
    const flip = R0(at.LeftUpLeg).x < o.x ? -1 : 1;                      // facing −Z: turn it round
    const n = g.pos.length / 3, rest = new Float32Array(n * 3), nrest = new Float32Array(n * 3), R = new Float32Array(NJ * 3);
    const put = (src, dst, i, isN) => {
      const x = isN ? src[i * 3] : (src[i * 3] - o.x) * sc, y = isN ? src[i * 3 + 1] : (src[i * 3 + 1] - o.y) * sc, z = isN ? src[i * 3 + 2] : (src[i * 3 + 2] - o.z) * sc;
      dst[i * 3] = x * flip; dst[i * 3 + 1] = y; dst[i * 3 + 2] = z * flip;
    };
    for (let i = 0; i < n; i++) { put(g.pos, rest, i, false); put(g.nrm, nrest, i, true); }
    for (let j = 0; j < NJ; j++) put(g.rest, R, j, false);
    const Rv = j => new THREE.Vector3(R[j * 3], R[j * 3 + 1], R[j * 3 + 2]);
    // joints in an order where parents come first
    const depth = j => (g.parent[j] < 0 ? 0 : 1 + depth(g.parent[j]));
    const order = [...Array(NJ).keys()].sort((a, b) => depth(a) - depth(b));
    const roles = names.map(roleOf);
    // hand frames at rest: along = wrist → middle knuckle, across = pinky → index knuckle (towards the thumb), palm normal
    const hand = {};
    for (const [n, S, s] of [['L', 'Left', 1], ['R', 'Right', -1]]) {
      const j = at[S + 'Hand'], jm = at[S + 'HandMiddle1'], ji = at[S + 'HandIndex1'], jp = at[S + 'HandPinky1'], jt1 = at[S + 'HandThumb1'], jt2 = at[S + 'HandThumb2'];
      const along = (jm != null ? Rv(jm) : Rv(j).add(Rv(j).sub(Rv(at[S + 'ForeArm'])).normalize().multiplyScalar(0.08))).sub(Rv(j)).normalize();
      const across = ji != null && jp != null ? Rv(ji).sub(Rv(jp)) : new THREE.Vector3(0, 0, 1);
      across.addScaledVector(along, -across.dot(along)).normalize();
      const palm = new THREE.Vector3().crossVectors(along, across).multiplyScalar(s).normalize();
      const fr = new THREE.Matrix4().makeBasis(along, across, palm), frT = fr.clone().transpose();
      const axisF = new THREE.Vector3().crossVectors(along, palm).normalize();
      const tdir = jt1 != null && jt2 != null ? Rv(jt2).sub(Rv(jt1)).normalize() : across.clone();
      const axisT1 = along.clone().multiplyScalar(s), axisT = new THREE.Vector3().crossVectors(tdir, palm).normalize();
      const len = jm != null ? Rv(jm).distanceTo(Rv(j)) : 0.08;
      const grip = Rv(j).addScaledVector(along, len * 0.55).addScaledVector(palm, len * 0.3);
      hand[n] = { j, frT, axisF, axisT1, axisT, grip, across, along };
    }
    // sole points at rest (heel under the ankle, ball, toe tip), each with the bone that carries it
    let floor = 1e9; for (let i = 0; i < n; i++) floor = Math.min(floor, rest[i * 3 + 1]);
    const soles = [];
    for (const S of ['Left', 'Right']) {
      const f = at[S + 'Foot'], tb = at[S + 'ToeBase'], te = at[S + 'Toe_End'];
      soles.push([f, Rv(f).setY(floor)]);
      if (tb != null) soles.push([f, Rv(tb).setY(floor)]);
      if (te != null && tb != null) soles.push([tb, Rv(te).setY(floor)]);
    }
    // muscle-tint zone of each vertex, from its strongest joint (zones as in rig.js: thighs, shins, upper arms, forearms, hips, trunk)
    const ZJ = { LeftUpLeg: 0, RightUpLeg: 1, LeftLeg: 2, RightLeg: 3, LeftArm: 4, RightArm: 5, LeftForeArm: 6, RightForeArm: 7 };
    const trunkZ = new Set(['Hips', 'Spine', 'Spine1', 'Spine2']), yHip = 0.02 + 0.16 * (B.torso - 0.02) / 0.34;
    const zone = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let best = 0, bw = -1; for (let k = 0; k < 4; k++) if (g.wgt[i * 4 + k] > bw) { bw = g.wgt[i * 4 + k]; best = g.jnt[i * 4 + k]; }
      const nm = names[best];
      zone[i] = nm in ZJ ? ZJ[nm] : trunkZ.has(nm) ? (rest[i * 3 + 1] < yHip ? 8 : 9) : -1;
    }
    // the mesh
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    const posAttr = new THREE.BufferAttribute(pos, 3), nrmAttr = new THREE.BufferAttribute(nrm, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage); nrmAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr); geo.setAttribute('normal', nrmAttr); geo.setAttribute('aZone', new THREE.BufferAttribute(zone, 1));
    geo.setAttribute('aRest', new THREE.BufferAttribute(rest, 3)); geo.setAttribute('aRestN', new THREE.BufferAttribute(nrest, 3));   // for the moiré lattice
    geo.setIndex(new THREE.BufferAttribute(g.idx, 1));
    solid = new THREE.Mesh(geo, meshMat); solidLine = new THREE.Mesh(geo, lineMat);
    for (const m of [solid, solidLine]) { m.frustumCulled = false; m.visible = false; scene.add(m); }
    M = { NJ, at, R, order, roles, parent: g.parent, hand, soles, rest, nrest, jnt: g.jnt, wgt: g.wgt, n, pos, nrm, posAttr, nrmAttr,
      Q: Array.from({ length: NJ }, () => new THREE.Quaternion()), Pw: Array.from({ length: NJ }, () => new THREE.Vector3()), X: new Float32Array(NJ * 12) };
    M.pb = buildParticles(g.idx, zone, Rv, at);
  }

  // ---- particles: points on the surface (barycentric on the skinned triangles), vessels along bones, the heart ----
  function buildParticles(idx, zone, Rv, at) {
    const { rest, nrest } = M, tri = idx.length / 3, area = new Float32Array(tri), A = new THREE.Vector3(), Bv = new THREE.Vector3(), Cv = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const v = (o, i) => o.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
    let total = 0;
    for (let t = 0; t < tri; t++) { v(A, idx[t * 3]); v(Bv, idx[t * 3 + 1]); v(Cv, idx[t * 3 + 2]); total += area[t] = e1.subVectors(Bv, A).cross(e2.subVectors(Cv, A)).length() / 2; }
    const cum = new Float32Array(tri); let acc = 0; for (let t = 0; t < tri; t++) cum[t] = acc += area[t] / total;
    const NB = 22000, tv = new Uint32Array(NB * 3), bw = new Float32Array(NB * 2), off = new Float32Array(NB), type = [], rnd = [], zn = [];
    for (let k = 0; k < NB; k++) {
      const r = Math.random(); let lo = 0, hi = tri - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      let u = Math.random(), w = Math.random(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
      tv[k * 3] = idx[lo * 3]; tv[k * 3 + 1] = idx[lo * 3 + 1]; tv[k * 3 + 2] = idx[lo * 3 + 2]; bw[k * 2] = u; bw[k * 2 + 1] = w;
      // most points on the skin (crisp silhouette), some in the volume, a few floating just outside as a halo
      const r2 = Math.random(), halo = r2 > 0.92;
      off[k] = halo ? (0.004 + 0.04 * Math.pow(Math.random(), 2)) : r2 < 0.72 ? -0.004 * Math.random() : -0.022 * Math.random();
      type.push(halo ? 5 : 0); rnd.push(Math.random()); zn.push(zone[idx[lo * 3]]);
    }
    void nrest;
    // vessels: an artery (front-inner) and a vein (back-outer) along the trunk and every long bone
    const ves = [];
    const pairs = [['Hips', 'Spine2'], ...['Left', 'Right'].flatMap(S => [['Arm', 'ForeArm'], ['ForeArm', 'Hand'], ['UpLeg', 'Leg'], ['Leg', 'Foot']].map(([a, b]) => [S + a, S + b]))];
    for (const [a, b] of pairs) {
      const ja = at[a], jb = at[b], L = Rv(ja).distanceTo(Rv(jb));
      for (const [ty, ox, oz] of [[2, 0.012, 0.018], [3, -0.012, -0.018]]) {
        const cnt = Math.round(L / 0.011);
        for (let k = 0; k < cnt; k++) { ves.push({ ja, jb, off: new THREE.Vector3(ox, a === 'Hips' ? 0 : 0, a === 'Hips' ? oz + 0.05 : oz), s: k / cnt, dir: ty === 2 ? 1 : -1 }); type.push(ty); rnd.push(Math.random()); zn.push(-1); }
      }
    }
    // heart: left chest, slightly forward, carried by the upper spine; swells on each beat
    const jc = at.Spine2, neck = at.Neck != null ? Rv(at.Neck) : Rv(jc);
    const heartR = Rv(at.Hips).lerp(neck, 0.72).add(new THREE.Vector3(0.035, 0, 0.05));
    const heart = [];
    for (let k = 0; k < 280; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, q = Math.sqrt(1 - u * u), r = 0.04 * Math.cbrt(Math.random());
      heart.push(new THREE.Vector3(q * Math.cos(a) * r, u * r * 1.2, q * Math.sin(a) * r)); type.push(4); rnd.push(Math.random()); zn.push(-1);
    }
    const body = particles.makeBody(type, rnd, zn);
    return { ...body, NB, tv, bw, off, ves, heart, heartR, jc, rnd };
  }

  // ---- per frame: bone rotations from the skeleton ----
  const _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
  const qPel = new THREE.Quaternion(), qChe = new THREE.Quaternion(), qHead = new THREE.Quaternion();
  const T = (o, p) => o.set(p.x, p.y, p.z);
  function basisQ(q, up, fw) {
    const y = T(_a, up).normalize(), z = T(_b, fw); z.addScaledVector(y, -z.dot(y)).normalize();
    _m.makeBasis(_c.crossVectors(y, z), y, z); q.setFromRotationMatrix(_m);
  }
  /** joint j's bone direction at rest (to `child`) turned by the parent's rotation, onto the target direction */
  function aim(j, pj, child, target) {
    const { R, Q } = M;
    _a.set(R[child * 3] - R[j * 3], R[child * 3 + 1] - R[j * 3 + 1], R[child * 3 + 2] - R[j * 3 + 2]).normalize().applyQuaternion(Q[pj]);
    if (target.lengthSq() < 1e-10) { Q[j].copy(Q[pj]); return; }
    _q.setFromUnitVectors(_a, target.normalize()); Q[j].copy(_q).multiply(Q[pj]);
  }
  /** @param {{ L: number[], R: number[] }} curl per hand, per finger 0 (open) – 1 (curled) */
  function pose(P, D, curl) {
    const { order, roles, parent, R, Q, Pw, at, hand } = M;
    basisQ(qPel, { x: P.chest.x - P.pelBot.x, y: P.chest.y - P.pelBot.y, z: P.chest.z - P.pelBot.z }, D.pelF || D.bodyF);
    basisQ(qChe, { x: P.chest.x - P.pelBot.x, y: P.chest.y - P.pelBot.y, z: P.chest.z - P.pelBot.z }, D.bodyF);
    basisQ(qHead, D.hu, D.hf);
    for (const j of order) {
      const r = roles[j], pj = parent[j];
      if (!r || pj < 0 && r.role !== 'pel') { Q[j].copy(pj >= 0 ? Q[pj] : qPel); }
      else if (r.role === 'pel') Q[j].copy(qPel);
      else if (r.role === 'spine') Q[j].copy(qPel).slerp(qChe, r.t);
      else if (r.role === 'chest') Q[j].copy(qChe);
      else if (r.role === 'neck') Q[j].copy(qChe).slerp(qHead, 0.5);
      else if (r.role === 'head') Q[j].copy(qHead);
      else if (r.role === 'clav') {                  // the shoulder rises with a raised arm (solve's girdle): follow chest → shoulder
        const s = r.n === 'L' ? 1 : -1, sh = P['sh' + r.n];
        _b.set(s * B.shW, -0.03, 0).applyQuaternion(qChe);
        _c.set(sh.x - P.chest.x, sh.y - P.chest.y, sh.z - P.chest.z);
        if (_c.lengthSq() > 1e-8) { _q.setFromUnitVectors(_b.normalize(), _c.normalize()); Q[j].copy(_q).multiply(Q[pj]); } else Q[j].copy(Q[pj]);
      } else if (r.role === 'limb') {
        const a = P[r.a], b = P[r.b], ch = at[r.child];
        aim(j, pj, ch, _c.set(b.x - a.x, b.y - a.y, b.z - a.z));
      } else if (r.role === 'foot') {                // our rest foot direction (shin vertical in both) onto the current one
        const an = P['an' + r.n], to = P['toe' + r.n], ra = RJ['an' + r.n], rt = RJ['toe' + r.n];
        _a.set(rt.x - ra.x, rt.y - ra.y, rt.z - ra.z).normalize().applyQuaternion(Q[pj]);
        _c.set(to.x - an.x, to.y - an.y, to.z - an.z);
        if (_c.lengthSq() > 1e-10) { _q.setFromUnitVectors(_a, _c.normalize()); Q[j].copy(_q).multiply(Q[pj]); } else Q[j].copy(Q[pj]);
      } else if (r.role === 'hand') {                // wrist → palm along the forearm's end, the thumb side from P.thumb
        const h = hand[r.n], wr = P['wr' + r.n], hd = P['hand' + r.n], th = P['thumb' + r.n];
        const al = _a.set(hd.x - wr.x, hd.y - wr.y, hd.z - wr.z);
        if (al.lengthSq() < 1e-10 || !th) { Q[j].copy(Q[pj]); continue; }
        al.normalize();
        // The thumb side from P.thumb is only defined while it stands off the wrist → palm line; at about 90° of elbow
        // bend (a curl) the two line up and then cross, which would whip the hand round. So it is blended towards the
        // hand frame carried over from the forearm by the shortest turn, by how far the thumb stands off (sine of the
        // angle), and kept on the side it had in the last frame.
        _d.copy(h.along).applyQuaternion(Q[pj]); _q.setFromUnitVectors(_d, al);
        _e.copy(h.across).applyQuaternion(Q[pj]).applyQuaternion(_q);              // carried thumb side
        const ac = _b.set(th.x - hd.x, th.y - hd.y, th.z - hd.z), tl = ac.length();
        ac.addScaledVector(al, -ac.dot(al));
        const w = tl > 1e-6 ? Math.min(1, Math.max(0, (ac.length() / tl - 0.25) / 0.35)) : 0;
        if (w > 0) ac.normalize();
        if (ac.dot(h.last || _e) < 0) ac.negate();  // past 90° of elbow bend the thumb's off-line part flips: keep it on last frame's side
        ac.multiplyScalar(w).addScaledVector(_e, 1 - w * w);
        ac.addScaledVector(al, -ac.dot(al));
        if (ac.lengthSq() < 1e-10) ac.copy(_e);
        ac.normalize(); (h.last || (h.last = new THREE.Vector3())).copy(ac);
        const pa = _c.crossVectors(al, ac).multiplyScalar(r.n === 'L' ? 1 : -1);
        _m2.makeBasis(al, ac, pa).multiply(h.frT); Q[j].setFromRotationMatrix(_m2);
      } else if (r.role === 'finger') {
        const h = hand[r.n], c = curl[r.n][r.f] || 0;
        if (c <= 0) { Q[j].copy(Q[pj]); continue; }
        const ax = r.f === 0 ? (r.k === 1 ? h.axisT1 : h.axisT) : h.axisF;
        _a.copy(ax).applyQuaternion(Q[h.j]);
        _q.setFromAxisAngle(_a, CURL[r.f][r.k - 1] * c); Q[j].copy(_q).multiply(Q[pj]);
      } else Q[j].copy(Q[pj]);
    }
    // positions down the chain, the root from the pelvis (our pelvis = the hip joints' midpoint = the model's origin)
    for (const j of order) {
      const pj = parent[j];
      if (pj < 0) Pw[j].set(R[j * 3], R[j * 3 + 1], R[j * 3 + 2]).applyQuaternion(Q[j]).add(T(_b, P.pel));
      else Pw[j].set(R[j * 3] - R[pj * 3], R[j * 3 + 1] - R[pj * 3 + 1], R[j * 3 + 2] - R[pj * 3 + 2]).applyQuaternion(Q[pj]).add(Pw[pj]);
    }
    // stand the model's soles where the skeleton's are
    let lowM = 1e9;
    for (const [b, p] of M.soles) lowM = Math.min(lowM, _a.set(p.x - R[b * 3], p.y - R[b * 3 + 1], p.z - R[b * 3 + 2]).applyQuaternion(Q[b]).add(Pw[b]).y);
    const lowP = Math.min(P.heelL.y, P.toeL.y, P.heelR.y, P.toeR.y) - B.footR, dy = lowP - lowM;
    for (let j = 0; j < M.NJ; j++) Pw[j].y += dy;
    // skinning matrices: x' = Q·x + (Pw − Q·R)
    const X = M.X;
    for (let j = 0; j < M.NJ; j++) {
      _m.makeRotationFromQuaternion(Q[j]); const e = _m.elements, o = j * 12;
      X[o] = e[0]; X[o + 1] = e[4]; X[o + 2] = e[8]; X[o + 4] = e[1]; X[o + 5] = e[5]; X[o + 6] = e[9]; X[o + 8] = e[2]; X[o + 9] = e[6]; X[o + 10] = e[10];
      const rx = R[j * 3], ry = R[j * 3 + 1], rz = R[j * 3 + 2];
      X[o + 3] = Pw[j].x - (e[0] * rx + e[4] * ry + e[8] * rz); X[o + 7] = Pw[j].y - (e[1] * rx + e[5] * ry + e[9] * rz); X[o + 11] = Pw[j].z - (e[2] * rx + e[6] * ry + e[10] * rz);
    }
  }
  function skinVerts() {
    const { n, rest, nrest, jnt, wgt, X, pos, nrm } = M;
    for (let i = 0; i < n; i++) {
      const o = i * 3, x = rest[o], y = rest[o + 1], z = rest[o + 2], nx = nrest[o], ny = nrest[o + 1], nz = nrest[o + 2];
      let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0;
      for (let k = 0; k < 4; k++) {
        const w = wgt[i * 4 + k]; if (!w) continue;
        const m = jnt[i * 4 + k] * 12;
        px += w * (X[m] * x + X[m + 1] * y + X[m + 2] * z + X[m + 3]); py += w * (X[m + 4] * x + X[m + 5] * y + X[m + 6] * z + X[m + 7]); pz += w * (X[m + 8] * x + X[m + 9] * y + X[m + 10] * z + X[m + 11]);
        qx += w * (X[m] * nx + X[m + 1] * ny + X[m + 2] * nz); qy += w * (X[m + 4] * nx + X[m + 5] * ny + X[m + 6] * nz); qz += w * (X[m + 8] * nx + X[m + 9] * ny + X[m + 10] * nz);
      }
      pos[o] = px; pos[o + 1] = py; pos[o + 2] = pz; nrm[o] = qx; nrm[o + 1] = qy; nrm[o + 2] = qz;
    }
  }
  function skinParticles(time, flow) {
    const { pos, nrm, Pw, Q, R } = M, pb = M.pb, out = pb.pos, { tv, bw, off } = pb;
    for (let k = 0; k < pb.NB; k++) {
      const a = tv[k * 3] * 3, b = tv[k * 3 + 1] * 3, c = tv[k * 3 + 2] * 3, u = bw[k * 2], w = bw[k * 2 + 1], t = 1 - u - w, f = off[k], o = k * 3;
      for (let e = 0; e < 3; e++) out[o + e] = pos[a + e] * t + pos[b + e] * u + pos[c + e] * w + (nrm[a + e] * t + nrm[b + e] * u + nrm[c + e] * w) * f;
    }
    let k = pb.NB;
    for (const v of pb.ves) {                         // slide along the bone; arteries flow away from the heart, veins back
      const s = ((v.s + v.dir * time * flow * (0.8 + 0.4 * pb.rnd[k])) % 1 + 1) % 1, A = Pw[v.ja], Bp = Pw[v.jb];
      _a.copy(v.off).applyQuaternion(Q[v.ja]);
      out[k * 3] = lerp(A.x, Bp.x, s) + _a.x; out[k * 3 + 1] = lerp(A.y, Bp.y, s) + _a.y; out[k * 3 + 2] = lerp(A.z, Bp.z, s) + _a.z; k++;
    }
    const beat = 1 + 0.32 * PU.uBeat.value, jc = pb.jc;
    _b.set(pb.heartR.x - R[jc * 3], pb.heartR.y - R[jc * 3 + 1], pb.heartR.z - R[jc * 3 + 2]).applyQuaternion(Q[jc]).add(Pw[jc]);
    for (const h of pb.heart) { out[k * 3] = _b.x + h.x * beat; out[k * 3 + 1] = _b.y + h.y * beat; out[k * 3 + 2] = _b.z + h.z * beat; k++; }
    pb.posAttr.needsUpdate = true;
  }

  return {
    load,
    get loaded() { return !!M; }, get solid() { return solid; }, get solidLine() { return solidLine; },
    /** make this model's particle body the one on screen */
    activate() { if (M) particles.use(M.pb); },
    /**
     * pose and skin for this frame; holo = particle view (the particles are placed from the skinned mesh)
     * @param {{ L: number[], R: number[] }} curl per-finger curl of each hand (thumb … pinky)
     */
    frame(P, D, curl, holo, time, flow) {
      pose(P, D, curl); skinVerts();
      if (holo) skinParticles(time, flow); else { M.posAttr.needsUpdate = true; M.nrmAttr.needsUpdate = true; }
    },
    /** dumbbell grip point in the posed hand and the handle's axis (across the palm) */
    gripOf(n, pos, axis) {
      if (!M) return false;
      const h = M.hand[n], j = h.j, R = M.R;
      pos.set(h.grip.x - R[j * 3], h.grip.y - R[j * 3 + 1], h.grip.z - R[j * 3 + 2]).applyQuaternion(M.Q[j]).add(M.Pw[j]);
      axis.copy(h.across).applyQuaternion(M.Q[j]).normalize();
      return true;
    },
    /**
     * the skeleton's joints moved onto the posed model's (for the angle arc, keypoint dots and moiré markers)
     * @param {import('../core/skeleton.js').Joints} P @returns {import('../core/skeleton.js').Joints}
     */
    mapP(P) {
      if (!M) return P;
      const out = { ...P }, J = k => M.Pw[M.at[k]];
      for (const [n, S] of [['L', 'Left'], ['R', 'Right']]) {
        for (const [k, b] of [['sh', 'Arm'], ['el', 'ForeArm'], ['wr', 'Hand'], ['hip', 'UpLeg'], ['kn', 'Leg'], ['an', 'Foot']]) out[k + n] = J(S + b).clone();
        const d = out['an' + n].clone().sub(P['an' + n]);
        for (const k of ['heel', 'toe', 'hand', 'thumb']) if (P[k + n]) out[k + n] = (k === 'hand' || k === 'thumb' ? out['wr' + n].clone().sub(P['wr' + n]) : d).clone().add(P[k + n]);
      }
      out.pel = out.hipL.clone().add(out.hipR).multiplyScalar(0.5);
      if (M.at.Neck != null) out.chest = J('Neck').clone();
      out.head = J('Head').clone().add(new THREE.Vector3(P.head.x - P.chest.x, P.head.y - P.chest.y, P.head.z - P.chest.z).normalize().multiplyScalar(0.07));
      return out;
    },
    /** for tests: the posed joint position by Mixamo name */
    joint(name) { return M && name in M.at ? M.Pw[M.at[name]] : null; },
    build
  };
}
