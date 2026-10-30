// The human model (male_body.glb, "Male Body" by Alexander Antipov, CC BY 4.0): a static mesh (no bones) in an A-pose,
// Y up, centimetres, feet at y = 0, facing +Z. It is bound to our skeleton here: joint positions were measured on the
// mesh (MJ in rig.js), every vertex follows its nearest bone (blending at joints), and per frame the vertices are moved
// on the CPU. load() also rebuilds the particle body from points on the mesh surface. If the file is missing, the
// built-in shapes stay in use.
import * as THREE from 'three';
import { v3, RM, MESH_CM, makeRig, trunkH } from './rig.js';
import { girdleW } from './poser.js';
import { makeFist, applyFist } from './hand.js';
import { parseGlb } from './glb.js';

/**
 * @param {{ scene: THREE.Scene, U: object, poser: ReturnType<import('./poser.js').createPoser>, particles: ReturnType<import('./particles.js').createParticles> }} o
 */
export function createBodyModel({ scene, U, poser, particles }) {
  let SM = null;                                       // skinned solid mesh state
  let solid = null, solidLine = null;
  const meshMat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.DoubleSide,
    vertexShader: `attribute float aZone; uniform float uAct[10]; varying vec3 vN; varying float vHeat;
      void main(){ vN = normalize(normalMatrix*normal); vHeat = aZone >= 0.0 ? clamp(uAct[int(aZone + 0.5)]*1.3, 0.0, 1.0) : 0.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
    fragmentShader: `uniform vec3 uLit, uDark, uHot, uL; uniform float uOn; varying vec3 vN; varying float vHeat;
      void main(){
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        float lit = smoothstep(0.1, 0.95, 0.5 + 0.5*dot(n, uL)), tone = lit*(0.55 + 0.45*clamp(n.z, 0.0, 1.0));
        vec3 c = mix(uDark, uLit, tone*uOn);
        gl_FragColor = vec4(mix(c, uHot*mix(1.0, 0.82 + 0.18*tone, uOn), vHeat), 1.0);
      }` });
  const meshLineMat = new THREE.ShaderMaterial({ uniforms: U, side: THREE.BackSide,
    vertexShader: `void main(){ gl_Position = projectionMatrix*modelViewMatrix*vec4(position + normal*0.007, 1.0); }`,
    fragmentShader: `uniform vec3 uRing; void main(){ gl_FragColor = vec4(uRing, 1.0); }` });
  async function loadBodyModel(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    const { P0, N0, idx } = parseGlb(buf);
    const n = P0.length / 3, rest = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { rest[i * 3] = P0[i * 3] / MESH_CM; rest[i * 3 + 1] = (P0[i * 3 + 1] - 88) / MESH_CM; rest[i * 3 + 2] = P0[i * 3 + 2] / MESH_CM; }
    const rig = makeRig(RM), b1 = new Uint8Array(n), b2 = new Uint8Array(n), w2 = new Float32Array(n), pv = new Uint8Array(n), th = new Float32Array(n), zone = new Float32Array(n), p = v3(0, 0, 0), nv = v3(0, 0, 0);
    for (let i = 0; i < n; i++) { p.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]); const s = rig.skinOf(p, nv.set(N0[i * 3], N0[i * 3 + 1], N0[i * 3 + 2])); b1[i] = s[0]; b2[i] = s[1]; w2[i] = s[2]; pv[i] = s[3]; th[i] = trunkH(p.y); zone[i] = rig.zoneOf(s[0], p); }
    // Shoulders: in the A-pose the side of the chest, the lats and the inside of the upper arm almost touch, so no rule
    // based on distance can separate them. Instead the arm-vs-trunk share is DIFFUSED over the mesh surface
    // (Pinocchio-style "heat" weights): vertices that are clearly arm are fixed at 1, clearly trunk at 0, and the rest
    // take the average of their neighbours until it settles. Chest and inner arm are only connected through the
    // armpit, so the transition lands there. Duplicate vertices (UV seams) are welded first so the surface is connected.
    {
      const weld = new Int32Array(n), seen = new Map();
      for (let i = 0; i < n; i++) { const k = Math.round(rest[i * 3] * 4000) + ',' + Math.round(rest[i * 3 + 1] * 4000) + ',' + Math.round(rest[i * 3 + 2] * 4000); if (seen.has(k)) weld[i] = seen.get(k); else { seen.set(k, i); weld[i] = i; } }
      const deg = new Int32Array(n + 1);
      for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { deg[weld[idx[t + e]]] += 2; }
      const off = new Int32Array(n + 1); for (let i = 0; i < n; i++) off[i + 1] = off[i] + deg[i];
      const fill = off.slice(0, n), nb = new Int32Array(off[n]);
      for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) {
        const a = weld[idx[t + e]], b = weld[idx[t + (e + 1) % 3]], c = weld[idx[t + (e + 2) % 3]];
        nb[fill[a]++] = b; nb[fill[a]++] = c;
      }
      const rel = v3(0, 0, 0);
      for (const [ua, side] of [[2, 1], [5, -1]]) {
        const sh = rig.restA[ua], dir = rig.restDir[ua], a = new Float32Array(n), free = [];
        const inZone = i => rest[i * 3] * side > 0.02 && rel.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]).sub(sh).length() < 0.24 && rest[i * 3 + 1] < sh.y + 0.15 && b1[i] !== 1 && b2[i] !== 1;
        for (let i = 0; i < n; i++) {
          if (weld[i] !== i) continue;
          const armSide = (b1[i] === ua || b1[i] === ua + 1 || b1[i] === ua + 2);
          if (!inZone(i)) { a[i] = armSide ? 1 : 0; continue; }          // outside the shoulder zone: keep what we had
          rel.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]).sub(sh);
          const s = rel.dot(dir), perp = rel.clone().addScaledVector(dir, -s).length();
          if (s > 0.07 && perp < 0.052) a[i] = 1;                         // clearly the upper arm (within its radius)
          else if (Math.abs(rest[i * 3]) < 0.1 || (perp > 0.085 && Math.abs(rest[i * 3]) < 0.19 && s > 0.04)) a[i] = 0;   // chest, back, side of the chest
          else { a[i] = 0.5; free.push(i); }
        }
        for (let it = 0; it < 400; it++) for (const i of free) { let sum = 0; for (let j = off[i]; j < off[i + 1]; j++) sum += a[nb[j]]; a[i] = off[i + 1] > off[i] ? sum / (off[i + 1] - off[i]) : a[i]; }
        for (let i = 0; i < n; i++) {
          if (!inZone(i)) continue;
          const w = a[weld[i]];
          if (w > 0.5) { b1[i] = ua; b2[i] = 0; w2[i] = 1 - w; } else { b1[i] = 0; b2[i] = ua; w2[i] = w; }
          pv[i] = ua; p.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]); zone[i] = rig.zoneOf(b1[i], p);
        }
      }
    }
    // solid: the mesh itself
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3);
    const posAttr = new THREE.BufferAttribute(pos, 3), nrmAttr = new THREE.BufferAttribute(nrm, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage); nrmAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr); geo.setAttribute('normal', nrmAttr); geo.setAttribute('aZone', new THREE.BufferAttribute(zone, 1)); geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.setAttribute('aRest', new THREE.BufferAttribute(Float32Array.from(rest), 3)); geo.setAttribute('aRestN', new THREE.BufferAttribute(Float32Array.from(N0), 3));   // for the moiré lattice
    solid = new THREE.Mesh(geo, meshMat); solidLine = new THREE.Mesh(geo, meshLineMat);
    for (const m of [solid, solidLine]) { m.frustumCulled = false; scene.add(m); }
    const gw = new Float32Array(n);
    for (let i = 0; i < n; i++) if (b1[i] === 0 || b2[i] === 0) gw[i] = girdleW(rig, rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
    SM = { rig, rest, nrest: N0, b1, b2, w2, pv, th, gw, pos, nrm, posAttr, nrmAttr, n };
    // particles: area-weighted points on the surface, pushed a little inward so the body has some depth
    const tri = idx.length / 3, area = new Float32Array(tri);
    let total = 0;
    const A = v3(0, 0, 0), Bv = v3(0, 0, 0), Cv = v3(0, 0, 0), e1 = v3(0, 0, 0), e2 = v3(0, 0, 0);
    const at = (o, i) => o.set(rest[i * 3], rest[i * 3 + 1], rest[i * 3 + 2]);
    for (let t = 0; t < tri; t++) { at(A, idx[t * 3]); at(Bv, idx[t * 3 + 1]); at(Cv, idx[t * 3 + 2]); total += area[t] = e1.subVectors(Bv, A).cross(e2.subVectors(Cv, A)).length() / 2; }
    const cum = new Float32Array(tri); let acc = 0; for (let t = 0; t < tri; t++) cum[t] = acc += area[t] / total;
    const pts = [];
    for (let k = 0; k < 22000; k++) {
      const r = Math.random(); let lo = 0, hi = tri - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
      const i0 = idx[lo * 3], i1 = idx[lo * 3 + 1], i2 = idx[lo * 3 + 2];
      let u = Math.random(), w = Math.random(); if (u + w > 1) { u = 1 - u; w = 1 - w; }
      at(A, i0); at(Bv, i1); at(Cv, i2);
      const q = A.clone().multiplyScalar(1 - u - w).addScaledVector(Bv, u).addScaledVector(Cv, w);
      const nn = v3(N0[i0 * 3] + N0[i1 * 3] + N0[i2 * 3], N0[i0 * 3 + 1] + N0[i1 * 3 + 1] + N0[i2 * 3 + 1], N0[i0 * 3 + 2] + N0[i1 * 3 + 2] + N0[i2 * 3 + 2]).normalize();
      // most points sit on the skin (so the silhouette is crisp), some fill the volume, a few float just outside as a halo
      const r2 = Math.random(), halo = r2 > 0.92;
      const off = halo ? (0.004 + 0.04 * Math.pow(Math.random(), 2)) : r2 < 0.72 ? -0.004 * Math.random() : -0.022 * Math.random();
      const pt = q.addScaledVector(nn, off); pt.n = nn; pt.halo = halo;
      pt.skin = [b1[i0], b2[i0], w2[i0], pv[i0]];        // same weights as the mesh, so both views bend alike
      pts.push(pt);
    }
    particles.build(rig, pts);
    const fistOf = makeFist(rig), PB = particles.body;
    SM.fist = fistOf(rest, N0); PB.fist = fistOf(PB.rest, null, k => !PB.ves[k]);
  }
  /** g = grip amount of the hands (0 open – 1 fist) */
  function skinMesh(P, D, g) {
    applyFist(SM.fist, SM.rest, SM.nrest, g); poser.setGirdle(SM.gw);
    poser.poseBones(SM.rig, P, D); const { rest, nrest, b1, b2, w2, pv, th, pos, nrm } = SM;
    for (let k = 0; k < SM.n; k++) {
      const o = k * 3;
      poser.blend(k, b1, b2, w2, pv, th, rest[o], rest[o + 1], rest[o + 2], pos, o, true);
      poser.blend(k, b1, b2, w2, pv, th, nrest[o], nrest[o + 1], nrest[o + 2], nrm, o, false);
    }
    SM.posAttr.needsUpdate = true; SM.nrmAttr.needsUpdate = true;
  }
  return {
    meshMat, load: loadBodyModel, skin: skinMesh,
    get loaded() { return !!SM; }, get solid() { return solid; }, get solidLine() { return solidLine; }
  };
}
