// The built-in solid body: the capsules of SEG ray-marched as one smooth-blended distance field on a camera-facing card.
// Used until male_body.glb has loaded (or if it cannot be loaded).
import * as THREE from 'three';
import { ANAT, SEG } from './anatomy.js';

/** @param {object} U shared body uniforms (see stage.js) @returns {THREE.Mesh} */
export function createSdfBody(U) {
  const N = SEG.length;
  // Ray-march the union of the capsules. Segments of one limb blend softly into each other; a limb blends into the
  // torso only near its shoulder / hip joint, so an arm hanging beside the body stays a separate shape.
  // ANAT numbers are written into the shader as float literals; the trunk profile becomes a chain of mix() segments
  const G = v => (Math.round(v * 10000) / 10000).toFixed(4);
  const GL_TRUNK = (() => {
    const T = ANAT.trunk; let s = `y = clamp(y, ${G(T[0][0])}, ${G(T[T.length - 1][0])}); `;
    for (let i = 1; i < T.length; i++) s += (i < T.length - 1 ? `if (y < ${G(T[i][0])}) ` : '') + `return mix(${G(T[i - 1][1])}, ${G(T[i][1])}, (y - ${G(T[i - 1][0])})/${G(T[i][0] - T[i - 1][0])}); `;
    return s;
  })();
  const bodyFS = `
    uniform vec3 uA[${N}]; uniform vec3 uB[${N}]; uniform float uR[${N}];
    uniform vec3 uLit, uDark, uRing, uHot, uL, uDir, uFwd, uHu, uHf; uniform float uOn, uLine, uPx; uniform float uAct[10]; uniform mat4 uVP;
    varying vec3 vW;
    float cap(vec3 p, vec3 a, vec3 b, float r){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba*h) - r; }
    float smin(float a, float b, float k){ k = max(k, 1e-4); float h = max(k - abs(a - b), 0.0)/k; return min(a, b) - h*h*k*0.25; }
    float near(vec3 p, vec3 j, float r0, float r1){ return 1.0 - smoothstep(r0, r1, length(p - j)); }
    float mem(vec3 p, vec3 a, vec3 b, float r){ return 1.0 - smoothstep(0.0, 0.05, cap(p, a, b, r)); }     // how much a surface point belongs to one segment
    float rcap(vec3 p, vec3 a, vec3 b, float ra, float rb){ vec3 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/max(dot(ba, ba), 1e-6), 0.0, 1.0); return length(pa - ba*h) - mix(ra, rb, h); }
    float ellip(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0 - 1.0)/max(k1, 1e-6); }
    float trunkR(float y){ ${GL_TRUNK} }
    float arm(vec3 p, int s){                       // s = 0 left, 1 right: upper arm, forearm, hand, deltoid
      vec3 sh = s == 0 ? uA[2] : uA[5], el = s == 0 ? uB[2] : uB[5], wr = s == 0 ? uB[3] : uB[6];
      float d = smin(rcap(p, sh, el, ${G(ANAT.ua[0])}, ${G(ANAT.ua[1])}), rcap(p, el, wr, ${G(ANAT.fa[0])}, ${G(ANAT.fa[1])}), 0.02);
      d = smin(d, rcap(p, wr, wr + normalize(wr - el)*${G(ANAT.hand[2])}, ${G(ANAT.hand[0])}, ${G(ANAT.hand[1])}), 0.02);
      return smin(d, length(p - sh) - ${G(ANAT.delt)}, 0.03);
    }
    float leg(vec3 p, int s){                       // thigh, shin with a calf bulge, foot
      vec3 hp = s == 0 ? uA[8] : uA[11], kn = s == 0 ? uB[8] : uB[11], an = s == 0 ? uB[9] : uB[12];
      vec3 he = s == 0 ? uA[10] : uA[13], to = s == 0 ? uB[10] : uB[13];
      float c = dot(p - kn, normalize(an - kn));
      float d = smin(rcap(p, hp, kn, ${G(ANAT.th[0])}, ${G(ANAT.th[1])}),
                     rcap(p, kn, an, ${G(ANAT.sh[0])}, ${G(ANAT.sh[1])}) - ${G(ANAT.calf[0])}*exp(-pow((c - ${G(ANAT.calf[1])})/${G(ANAT.calf[2])}, 2.0)), 0.02);
      return smin(d, rcap(p, he, to, ${G(ANAT.foot[0])}, ${G(ANAT.foot[1])}), 0.03);
    }
    float map(vec3 p){
      // trunk: elliptical section in the body's own frame, with chest / waist / hip profile
      vec3 ty = normalize(uB[0] - uA[0]), tz = normalize(uFwd - ty*dot(uFwd, ty)), tx = cross(ty, tz), q = p - uA[0];
      float yy = dot(q, ty) + 0.02, rx = trunkR(yy), rz = rx*${G(ANAT.depth)};
      float d = max((length(vec2(dot(q, tx)/rx, dot(q, tz)/rz)) - 1.0)*rz, max(${G(ANAT.trunk[0][0])} - yy, yy - ${G(ANAT.trunk[ANAT.trunk.length - 1][0])}));
      d = smin(d, rcap(p, uB[0], uB[0] + ty*${G(ANAT.neck[2])}, ${G(ANAT.neck[0])}, ${G(ANAT.neck[1])}), 0.04);
      // trapezius: slopes from the base of the neck down to each shoulder
      d = smin(d, rcap(p, uB[0] + ty*${G(ANAT.trap[0])}, uA[2], ${G(ANAT.trap[1])}, ${G(ANAT.trap[2])}), 0.04);
      d = smin(d, rcap(p, uB[0] + ty*${G(ANAT.trap[0])}, uA[5], ${G(ANAT.trap[1])}, ${G(ANAT.trap[2])}), 0.04);
      // head: ellipsoid in the head's frame
      vec3 hy = normalize(uHu), hz = normalize(uHf - hy*dot(uHf, hy)), hx = cross(hy, hz), hq = p - uA[1] - hz*0.01;
      d = smin(d, ellip(vec3(dot(hq, hx), dot(hq, hy), dot(hq, hz)), vec3(${G(ANAT.head[0])}, ${G(ANAT.head[1])}, ${G(ANAT.head[2])})), 0.03);
      // limbs join the trunk only near their shoulder / hip, so an arm swinging past the body stays separate
      d = smin(d, arm(p, 0), 0.04*near(p, uA[2], 0.05, 0.2) + 1e-4);
      d = smin(d, arm(p, 1), 0.04*near(p, uA[5], 0.05, 0.2) + 1e-4);
      d = smin(d, leg(p, 0), 0.03*near(p, uA[8], 0.06, 0.22) + 1e-4);
      d = smin(d, leg(p, 1), 0.03*near(p, uA[11], 0.06, 0.22) + 1e-4);
      return d;
    }
    void main(){
      vec3 ro = vW - uDir*1.4; float t = 0.0, md = 1e3; bool hit = false;
      for (int i = 0; i < 44; i++) { float d = map(ro + uDir*t); md = min(md, d); if (d < 0.0012) { hit = true; break; } t += d; if (t > 2.8) break; }
      if (!hit) {
        // anti-aliased edge, plus an optional thin contour just outside the silhouette
        float edge = 1.0 - smoothstep(0.0, uPx*1.5, md);
        float ring = uLine*(1.0 - smoothstep(0.012, 0.012 + uPx*1.5, md));
        float al = max(edge, ring);
        if (al < 0.01) discard;
        gl_FragColor = vec4(mix(uRing, uDark, edge), al);
        gl_FragDepthEXT = 0.99999;
        return;
      }
      vec3 p = ro + uDir*t; vec2 e = vec2(0.002, -0.002);
      vec3 n = normalize(e.xyy*map(p + e.xyy) + e.yyx*map(p + e.yyx) + e.yxy*map(p + e.yxy) + e.xxx*map(p + e.xxx));
      vec3 nv = normalize(mat3(viewMatrix)*n);
      float lit = smoothstep(0.1, 0.95, 0.5 + 0.5*dot(nv, uL));
      float tone = lit*(0.55 + 0.45*clamp(nv.z, 0.0, 1.0));      // soft matte light that falls off toward the rim; off = one flat colour
      // muscle zones: thighs, calves, upper arms, forearms, then lower / upper torso
      float heat = max(uAct[0]*mem(p, uA[8], uB[8], uR[8]), uAct[1]*mem(p, uA[11], uB[11], uR[11]));
      heat = max(heat, max(uAct[2]*mem(p, uA[9], uB[9], uR[9]), uAct[3]*mem(p, uA[12], uB[12], uR[12])));
      heat = max(heat, max(uAct[4]*mem(p, uA[2], uB[2], uR[2]), uAct[5]*mem(p, uA[5], uB[5], uR[5])));
      heat = max(heat, max(uAct[6]*mem(p, uA[3], uB[3], uR[3]), uAct[7]*mem(p, uA[6], uB[6], uR[6])));
      vec3 ax = uB[0] - uA[0]; float th = clamp(dot(p - uA[0], ax)/max(dot(ax, ax), 1e-6), 0.0, 1.0);
      heat = max(heat, mix(uAct[8], uAct[9], smoothstep(0.3, 0.7, th))*mem(p, uA[0], uB[0], uR[0]));
      vec3 c = mix(uDark, uLit, tone*uOn);
      gl_FragColor = vec4(mix(c, uHot*mix(1.0, 0.82 + 0.18*tone, uOn), heat), 1.0);
      vec4 cp = uVP*vec4(p, 1.0); gl_FragDepthEXT = cp.z/cp.w*0.5 + 0.5;
    }`;
  const bodyMat = new THREE.ShaderMaterial({ uniforms: U, transparent: true, extensions: { fragDepth: true },
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`, fragmentShader: bodyFS });
  const body = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.7), bodyMat);      // camera-facing card the rays start from
  body.frustumCulled = false;
  return body;
}
