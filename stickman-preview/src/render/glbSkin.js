// Reader for rigged GLB files (Mixamo characters such as Xbot / Michelle): every skinned mesh of the default scene,
// merged into one, posed in its rest pose (the node transforms) in world space. Pure (three.js math only), so it can
// run in Node for tests.
import * as THREE from 'three';

/**
 * @typedef {{ pos: Float32Array, nrm: Float32Array, idx: Uint32Array, jnt: Uint16Array, wgt: Float32Array,
 *   names: string[], parent: Int16Array, rest: Float32Array }} SkinnedGlb
 *   pos / nrm = rest-pose vertices in world space (metres for these files), idx = triangles, jnt / wgt = 4 joints and
 *   weights per vertex (joint = index into names), names / parent / rest = the joints (parent -1 = root, rest = world position)
 */

const COMPS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
const TYPES = { 5120: ['getInt8', 1, 127], 5121: ['getUint8', 1, 255], 5122: ['getInt16', 2, 32767], 5123: ['getUint16', 2, 65535], 5125: ['getUint32', 4, 0], 5126: ['getFloat32', 4, 0] };

/** @param {ArrayBuffer} buf @returns {SkinnedGlb} */
export function parseSkinnedGlb(buf) {
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546C67) throw new Error('not a GLB');
  const jl = dv.getUint32(12, true), json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl))), bin = 20 + jl + 8;
  // any accessor as plain numbers (strides and normalised integers handled)
  const read = ai => {
    const a = json.accessors[ai], bv = json.bufferViews[a.bufferView], [fn, size, max] = TYPES[a.componentType], n = COMPS[a.type];
    const stride = bv.byteStride || n * size, base = bin + (bv.byteOffset || 0) + (a.byteOffset || 0), out = new Float64Array(a.count * n);
    for (let i = 0; i < a.count; i++) for (let c = 0; c < n; c++) {
      const v = dv[fn](base + i * stride + c * size, true);
      out[i * n + c] = a.normalized && max ? Math.max(v / max, -1) : v;
    }
    return out;
  };
  // world matrices of the default scene
  const nodes = json.nodes, W = nodes.map(() => null), par = new Int32Array(nodes.length).fill(-1);
  nodes.forEach((nd, i) => (nd.children || []).forEach(c => { par[c] = i; }));
  const local = nd => {
    const m = new THREE.Matrix4();
    if (nd.matrix) return m.fromArray(nd.matrix);
    const t = nd.translation || [0, 0, 0], r = nd.rotation || [0, 0, 0, 1], s = nd.scale || [1, 1, 1];
    return m.compose(new THREE.Vector3(...t), new THREE.Quaternion(...r), new THREE.Vector3(...s));
  };
  const world = i => W[i] || (W[i] = par[i] < 0 ? local(nodes[i]) : world(par[i]).clone().multiply(local(nodes[i])));
  // joints: every node used by a skin
  const jIdx = new Map(), names = [], jNode = [];
  for (const sk of json.skins || []) for (const nd of sk.joints) if (!jIdx.has(nd)) { jIdx.set(nd, names.length); names.push(nodes[nd].name || 'joint' + nd); jNode.push(nd); }
  const parent = new Int16Array(names.length).fill(-1), rest = new Float32Array(names.length * 3), v = new THREE.Vector3();
  jNode.forEach((nd, j) => {
    let p = par[nd]; while (p >= 0 && !jIdx.has(p)) p = par[p];
    parent[j] = p >= 0 ? jIdx.get(p) : -1;
    v.setFromMatrixPosition(world(nd)); rest[j * 3] = v.x; rest[j * 3 + 1] = v.y; rest[j * 3 + 2] = v.z;
  });
  // skinned meshes, skinned into their rest pose: v_world = Σ w · (joint world · inverse bind) · v
  const P = [], N = [], I = [], J = [], G = [];
  nodes.forEach(nd => {
    if (nd.mesh == null || nd.skin == null) return;
    const sk = json.skins[nd.skin], ibm = sk.inverseBindMatrices != null ? read(sk.inverseBindMatrices) : null;
    const M = sk.joints.map((jn, k) => { const m = world(jn).clone(); if (ibm) m.multiply(new THREE.Matrix4().fromArray(ibm, k * 16)); return m; });
    const Mn = M.map(m => new THREE.Matrix3().setFromMatrix4(m));
    for (const pr of json.meshes[nd.mesh].primitives) {
      if ((pr.mode ?? 4) !== 4) continue;
      const at = pr.attributes, pos = read(at.POSITION), nrm = at.NORMAL != null ? read(at.NORMAL) : null, jt = read(at.JOINTS_0), wt = read(at.WEIGHTS_0);
      const n = pos.length / 3, off = P.length / 3, a = new THREE.Vector3(), o = new THREE.Vector3(), on = new THREE.Vector3();
      for (let i = 0; i < n; i++) {
        let ws = 0; for (let k = 0; k < 4; k++) ws += wt[i * 4 + k];
        o.set(0, 0, 0); on.set(0, 0, 0);
        for (let k = 0; k < 4; k++) {
          const w = wt[i * 4 + k] / (ws || 1); if (!w) continue;
          const jk = jt[i * 4 + k];
          a.set(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]).applyMatrix4(M[jk]); o.addScaledVector(a, w);
          if (nrm) { a.set(nrm[i * 3], nrm[i * 3 + 1], nrm[i * 3 + 2]).applyMatrix3(Mn[jk]); on.addScaledVector(a, w); }
          J.push(jIdx.get(sk.joints[jk])); G.push(w);
        }
        for (let k = 0; k < 4; k++) if (!(wt[i * 4 + k] / (ws || 1))) { J.push(0); G.push(0); }
        on.normalize();
        P.push(o.x, o.y, o.z); N.push(on.x, on.y, on.z);
      }
      const ix = pr.indices != null ? read(pr.indices) : Array.from({ length: n }, (_, i) => i);
      for (let i = 0; i < ix.length; i++) I.push(ix[i] + off);
    }
  });
  if (!P.length) throw new Error('no skinned mesh');
  return { pos: Float32Array.from(P), nrm: Float32Array.from(N), idx: Uint32Array.from(I), jnt: Uint16Array.from(J), wgt: Float32Array.from(G), names, parent, rest };
}
