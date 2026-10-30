import * as THREE from 'three';
import { add, sub, mul, TAU } from '../core/math.js';

// Moiré body, done the way the COBE globe does it: a lattice of hard-edged dots about one pixel across and ~2.3 screen
// pixels apart (MOIRE_PX). Dots that small beat against the pixel grid, and because the lattice keeps turning slowly
// (like the globe spinning) the moiré flows all the time, even when the figure stands still. The lattice rows are
// bent into a spiral around the chest, so the bands curl the way the globe's do. Brightest where the skin faces the
// camera, a faint glow on the rim, working muscle groups in orange. Lattice plane picked from the rest normal.
export const MOIRE_PX = 2.3;

/** @param {{ scene: THREE.Scene, U: object, PU: object }} o  shared body / particle uniforms (see stage.js) */
export function createMoire({ scene, U, PU }) {
  const col = h => new THREE.Color(h);
  const MU = { uAct: U.uAct, uTime: PU.uTime, uSp: { value: 0.004 }, uDot: { value: col('#E6EBEF') }, uHotM: { value: col('#FF8A5B') }, uBase: { value: col('#111419') }, uGlow: { value: col('#3B4656') } };
  const moireMat = new THREE.ShaderMaterial({ uniforms: MU, side: THREE.DoubleSide,
    vertexShader: `attribute float aZone; attribute vec3 aRest, aRestN; uniform float uAct[10]; varying vec3 vN, vR, vRN; varying float vHeat;
      void main(){ vN = normalize(normalMatrix*normal); vR = aRest; vRN = aRestN; vHeat = aZone >= 0.0 ? clamp(uAct[int(aZone + 0.5)]*1.3, 0.0, 1.0) : 0.0; gl_Position = projectionMatrix*modelViewMatrix*vec4(position, 1.0); }`,
    fragmentShader: `uniform float uTime, uSp; uniform vec3 uDot, uHotM, uBase, uGlow; varying vec3 vN, vR, vRN; varying float vHeat;
      float hexD(vec2 p){ vec2 r = vec2(1.0, 1.7320508), a = mod(p, r) - r*0.5, b = mod(p - r*0.5, r) - r*0.5; return min(dot(a, a), dot(b, b)); }
      vec2 rot(vec2 p, float a){ float c = cos(a), s = sin(a); return vec2(c*p.x - s*p.y, s*p.x + c*p.y); }
      void main(){
        vec3 n = normalize(vN); if (!gl_FrontFacing) n = -n;
        vec3 an = abs(vRN);
        vec2 uv = an.x > an.y && an.x > an.z ? vR.zy : (an.y > an.z ? vR.xz : vR.xy);
        vec2 q = uv - vec2(0.0, 0.32);                                // around the chest (rest units, 1 = 120 cm)
        q = rot(q, uTime*0.05 + length(q)*2.2);                       // slow spin + spiral bend of the rows
        float dotM = step(hexD(q/uSp + 0.37), 0.05);                  // ~1 px dots (0.45 pitch), hard edge on purpose
        float face = clamp(n.z, 0.0, 1.0);
        vec3 c = uBase*(0.55 + 0.45*face) + dotM*mix(uDot, uHotM, vHeat)*(0.18 + 0.82*pow(face, 0.6)) + pow(1.0 - face, 3.0)*uGlow;
        gl_FragColor = vec4(c, 1.0);
      }` });
  // moiré markers (like the city lights on the globe): glowing points on the joints that breathe, and the heart in orange
  // pulsing with the heartbeat. Drawn over the body (no depth test), positions refreshed every frame from the skeleton.
  const MARK = ['head', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR'], mkN = MARK.length + 1;
  const mkGeo = new THREE.BufferGeometry(), mkPos = new Float32Array(mkN * 3), mkPh = new Float32Array(mkN), mkHeart = new Float32Array(mkN);
  for (let i = 0; i < mkN; i++) mkPh[i] = Math.random() * TAU; mkHeart[mkN - 1] = 1;
  mkGeo.setAttribute('position', new THREE.BufferAttribute(mkPos, 3)); mkGeo.setAttribute('aPh', new THREE.BufferAttribute(mkPh, 1)); mkGeo.setAttribute('aHeart', new THREE.BufferAttribute(mkHeart, 1));
  const marks = new THREE.Points(mkGeo, new THREE.ShaderMaterial({ uniforms: PU, transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float aPh, aHeart; uniform float uTime, uBeat, uPR; varying float vH;
      void main(){ vH = aHeart; gl_Position = projectionMatrix*viewMatrix*vec4(position, 1.0);
        gl_PointSize = uPR*(aHeart > 0.5 ? 20.0 + 14.0*uBeat : 11.0*(1.0 + 0.12*sin(uTime*4.0 + aPh))); }`,
    fragmentShader: `varying float vH;
      void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d)*0.55 + smoothstep(0.17, 0.1, d);
        gl_FragColor = vec4((vH > 0.5 ? vec3(1.0, 0.45, 0.3) : vec3(0.95, 0.97, 1.0))*a, a); }` }));
  marks.frustumCulled = false; marks.visible = false; marks.renderOrder = 5; scene.add(marks);
  function placeMarks(P, D) {
    MARK.forEach((k, i) => { const p = P[k]; mkPos[i * 3] = p.x; mkPos[i * 3 + 1] = p.y; mkPos[i * 3 + 2] = p.z; });
    const h = add(add(add(P.chest, mul(sub(P.pelBot, P.chest), 0.22)), mul(D.bodyF, 0.07)), mul(D.side, 0.035)), o = (mkN - 1) * 3;
    mkPos[o] = h.x; mkPos[o + 1] = h.y; mkPos[o + 2] = h.z; mkGeo.attributes.position.needsUpdate = true;
  }
  return { mat: moireMat, MU, marks, place: placeMarks };
}
