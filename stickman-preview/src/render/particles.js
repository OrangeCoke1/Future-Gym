// Particle hologram: ONE continuous body, sampled once in a rest pose and skinned to the skeleton, plus blood vessels,
// the heart and the floating motes over the platform. The built-in body is sampled from the rest-pose shape (bodyD);
// once male_body.glb has loaded, bodyModel.js rebuilds it from points on the mesh surface.
import * as THREE from 'three';
import { lerp, TAU } from '../core/math.js';
import { v3, RJ, bodyD, makeRig, trunkH } from './rig.js';
import { girdleW } from './poser.js';
import { applyFist } from './hand.js';

/**
 * @param {{ scene: THREE.Scene, PU: object, poser: ReturnType<import('./poser.js').createPoser> }} o  PU = particle uniforms (see stage.js)
 */
export function createParticles({ scene, PU, poser }) {
  // Look (after a reference clip): very fine, dense ice-blue sparkle. Points nearer the camera than the body's centre are
  // bright white, points behind it fade to deep blue, so the cloud reads as a solid volume; a few glints twinkle and a
  // thin halo of stray points hangs just off the skin. uForm (0 → 1) assembles the figure out of a swirling cloud.
  const pointFS = `varying vec3 vCol; varying float vA;
    void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float a = vA*(smoothstep(0.5, 0.18, d) + 0.6*smoothstep(0.2, 0.0, d)); gl_FragColor = vec4(vCol*a, a); }`;
  const pointMat = new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fragmentShader: pointFS,
    vertexShader: `
      attribute float aType, aRnd, aZone;
      uniform float uAct[10]; uniform vec3 uCol, uDeep, uHot, uArt, uVein, uCtr; uniform float uTime, uBeat, uShowB, uSize, uPR, uForm;
      varying vec3 vCol; varying float vA;
      void main(){
        bool halo = aType > 4.5;
        vec3 drift = vec3(sin(uTime*0.6 + aRnd*40.0), 1.3*sin(uTime*0.45 + aRnd*23.0), cos(uTime*0.55 + aRnd*31.0))*(halo ? 0.005 : 0.0025);
        vec3 p = position + drift;
        // assemble: each point leaves a slowly swirling sphere around the body and flies to its place, some sooner than others
        float f = clamp((uForm - aRnd*0.4)/0.6, 0.0, 1.0); f = f*f*(3.0 - 2.0*f);
        if (f < 1.0) {
          vec3 hh = fract(sin(aRnd*vec3(127.1, 311.7, 74.7) + vec3(1.3, 2.9, 4.1))*43758.5453);   // independent randoms per point
          float cz = hh.x*2.0 - 1.0, ca = hh.y*6.2832, sq = sqrt(1.0 - cz*cz);
          vec3 dir = vec3(sq*cos(ca), cz, sq*sin(ca));
          float rad = 0.62*pow(hh.z, 0.45), an = (1.0 - f)*2.6 + uTime*0.35, c = cos(an), s = sin(an);
          vec3 sc = uCtr + vec3(0.0, 0.15, 0.0) + vec3(c*dir.x - s*dir.z, dir.y, s*dir.x + c*dir.z)*rad;
          p = mix(sc, p, f);
        }
        vec4 mv = viewMatrix*vec4(p, 1.0);
        gl_Position = projectionMatrix*mv;
        float front = smoothstep(-0.1, 0.12, mv.z - (viewMatrix*vec4(uCtr, 1.0)).z);    // + = nearer the camera than the centre
        float tw = 0.9 + 0.1*fract(aRnd*13.7), glint = 0.0;            // steady brightness, no twinkle
        float size = 1.0;
        if (aType < 0.5 || halo) {                                     // body (and the halo around it)
          float heat = aZone >= 0.0 ? clamp(uAct[int(aZone + 0.5)]*1.6, 0.0, 1.0) : 0.0;
          vCol = mix(mix(uDeep, uCol, front), uHot, heat*0.6);
          vA = halo ? (0.14 + 0.3*front)*tw : (0.3 + 0.7*front)*tw + glint*0.9;
          size = halo ? 0.8 : 1.0 + glint*1.3;
          vA *= mix(0.55, 1.0, f);
        } else if (aType < 2.5) {                                      // artery: oxygen-rich
          vCol = uArt; vA = (0.75 + 0.25*uBeat)*uShowB; size = 1.05;
        } else if (aType < 3.5) {                                      // vein: oxygen given up to the muscles
          vCol = uVein; vA = 0.6*uShowB; size = 0.95;
        } else {                                                       // heart
          vCol = mix(uArt, vec3(1.0, 0.7, 0.66), uBeat*0.6); vA = (0.65 + 0.35*uBeat)*uShowB; size = 1.2 + 0.5*uBeat;
        }
        vA = clamp(vA, 0.0, 1.0);
        gl_PointSize = uSize*uPR*(0.7 + 0.6*aRnd)*size;
      }` });
  const points = new THREE.Points(new THREE.BufferGeometry(), pointMat); points.frustumCulled = false; scene.add(points);
  let PB = null;                                       // current particle body (procedural first, replaced once the model loads)
  function buildParticles(rig, bodyPts) {             // bodyPts: rest-pose points inside / on the body
    const rest = [], b1 = [], b2 = [], w2 = [], pv = [], th = [], type = [], rnd = [], zone = [], ves = [];
    const add = (p, ty, s, z, v) => { rest.push(p.x, p.y, p.z); b1.push(s[0]); b2.push(s[1]); w2.push(s[2]); pv.push(s[3] || 0); th.push(trunkH(v && v.a ? (v.a.y + v.b.y) / 2 : v && v.heart ? v.heart.y : p.y)); type.push(ty); rnd.push(Math.random()); zone.push(z); ves.push(v); };
    for (const p of bodyPts) { const s = p.skin || rig.skinOf(p, p.n); add(p, p.halo ? 5 : 0, s, rig.zoneOf(s[0], p), null); }
    // blood: an artery (front-inner) and a vein (back-outer) along every long bone; position along the vessel moves each frame
    const J = rig.J, up = J.chest.y - J.pelBot.y;
    for (const i of [0, 2, 3, 5, 6, 8, 9, 11, 12]) {
      const a = i === 0 ? v3(0.02, J.pelBot.y, J.pelBot.z + 0.05) : rig.restA[i], b = i === 0 ? v3(0.02, J.chest.y, J.chest.z + 0.05) : rig.restB[i], L = a.distanceTo(b);
      for (const [ty, off] of [[2, v3(0.012, 0, 0.018)], [3, v3(-0.012, 0, -0.018)]]) {
        const n = Math.round(L / 0.011);
        for (let k = 0; k < n; k++) add(v3(0, 0, 0), ty, [i, i, 0], -1, { a, b, off, s: k / n, dir: ty === 2 ? 1 : -1 });
      }
    }
    // heart: left chest, slightly forward; swells on each beat around its centre
    const heartC = v3(J.chest.x + 0.035, J.pelBot.y + up * 0.72, J.chest.z + 0.05);
    for (let k = 0; k < 280; k++) {
      const u = Math.random() * 2 - 1, a = Math.random() * TAU, q = Math.sqrt(1 - u * u), r = 0.04 * Math.cbrt(Math.random());
      add(v3(q * Math.cos(a) * r, u * r * 1.2, q * Math.sin(a) * r), 4, [0, 0, 0], -1, { heart: heartC });
    }
    const NP = b1.length, pos = new Float32Array(NP * 3), geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(pos, 3); posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);
    for (const [k, v] of [['aType', type], ['aRnd', rnd], ['aZone', zone]]) geo.setAttribute(k, new THREE.Float32BufferAttribute(v, 1));
    points.geometry.dispose(); points.geometry = geo;
    const gw = new Float32Array(NP);
    for (let k = 0; k < NP; k++) if (!ves[k]) gw[k] = girdleW(rig, rest[k * 3], rest[k * 3 + 1], rest[k * 3 + 2]);
    PB = { rig, rest: new Float32Array(rest), b1: new Uint8Array(b1), b2: new Uint8Array(b2), w2: new Float32Array(w2), pv: new Uint8Array(pv), th: new Float32Array(th), gw, ves, rnd, NP, pos, posAttr };
  }
  /** g = grip amount of the hands (0 open – 1 fist), one number or per hand { L, R } */
  function skinParticles(P, D, time, flow, g) {
    applyFist(PB.fist, PB.rest, null, g); poser.setGirdle(PB.gw);
    poser.poseBones(PB.rig, P, D); const beat = 1 + 0.32 * PU.uBeat.value, { rest, ves, pos } = PB;
    for (let k = 0; k < PB.NP; k++) {
      let x = rest[k * 3], y = rest[k * 3 + 1], z = rest[k * 3 + 2];
      const v = ves[k];
      if (v) {
        if (v.heart) { x = v.heart.x + x * beat; y = v.heart.y + y * beat; z = v.heart.z + z * beat; }
        else {                                        // slide along the vessel; arteries flow away from the heart, veins back
          const s = ((v.s + v.dir * time * flow * (0.8 + 0.4 * PB.rnd[k])) % 1 + 1) % 1;
          x = lerp(v.a.x, v.b.x, s) + v.off.x; y = lerp(v.a.y, v.b.y, s) + v.off.y; z = lerp(v.a.z, v.b.z, s) + v.off.z;
        }
      }
      poser.blend(k, PB.b1, PB.b2, PB.w2, PB.pv, PB.th, x, y, z, pos, k * 3, true);
    }
    PB.posAttr.needsUpdate = true;
  }
  // procedural body first (always available): even volume sampling inside the rest-pose shape
  {
    const pts = [];
    for (let tries = 0; pts.length < 10000 && tries < 600000; tries++) {
      const p = v3(lerp(-0.42, 0.42, Math.random()), lerp(-0.82, 0.73, Math.random()), lerp(-0.2, 0.28, Math.random()));
      if (bodyD(p) <= 0) pts.push(p);
    }
    buildParticles(makeRig(RJ), pts);
  }
  // floating particles: a loose cloud over the platform, densest close to where the figure stands. They live in world
  // space and drift on their own (slowly rising, swaying); they do NOT follow the figure.
  const mN = 3000, mPos = [], mRnd = [];
  for (let k = 0; k < mN; k++) { const t = Math.random() * TAU, r = 0.06 + 0.78 * Math.pow(Math.random(), 1.6); mPos.push(Math.cos(t) * r, Math.random() * 2.2, Math.sin(t) * r * 0.8); mRnd.push(Math.random()); }
  const mGeo = new THREE.BufferGeometry();
  mGeo.setAttribute('position', new THREE.Float32BufferAttribute(mPos, 3)); mGeo.setAttribute('aRnd', new THREE.Float32BufferAttribute(mRnd, 1));
  const motes = new THREE.Points(mGeo, new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fragmentShader: pointFS,
    vertexShader: `attribute float aRnd; uniform vec3 uCol, uDeep; uniform float uTime, uPR; varying vec3 vCol; varying float vA;
      void main(){
        float y = mod(position.y + uTime*(0.02 + 0.05*aRnd), 2.2);
        vec3 p = vec3(position.x + 0.05*sin(uTime*(0.3 + 0.3*aRnd) + aRnd*20.0), y, position.z + 0.05*cos(uTime*(0.25 + 0.3*aRnd) + aRnd*13.0));
        gl_Position = projectionMatrix*viewMatrix*vec4(p, 1.0);
        float r = length(position.xz);
        vCol = mix(uDeep, uCol, 0.25 + 0.5*aRnd); vA = (0.1 + 0.32*(1.0 - r/0.84))*smoothstep(0.0, 0.25, y)*smoothstep(2.2, 1.7, y)*(0.85 + 0.15*sin(uTime*0.6 + aRnd*30.0));
        gl_PointSize = (0.9 + 1.2*aRnd)*uPR;
      }` }));
  motes.frustumCulled = false; scene.add(motes);
  return {
    points, motes, build: buildParticles, skin: skinParticles,
    /** the current particle body (rest points, weights, vessels…) */
    get body() { return PB; }
  };
}
