// The stage: orthographic Three.js render of the figure (built-in SDF body → loaded human mesh, particle hologram or
// moiré lattice), eyes, dumbbells, floor and contact shadow. createStage() returns null when WebGL is unavailable.
import * as THREE from 'three';
import { nrm, clamp } from '../core/math.js';
import { SEG, ANAT } from './anatomy.js';
import { createSdfBody } from './sdfBody.js';
import { createPoser } from './poser.js';
import { createParticles } from './particles.js';
import { createBodyModel } from './bodyModel.js';
import { createRiggedModel } from './riggedModel.js';
import { createMoire, MOIRE_PX } from './moire.js';

/** @typedef {'solid' | 'particle' | 'moire'} LookMode */
/** @typedef {'male' | 'xbot' | 'michelle'} BodyKey */
/** body models: male_body.glb (bound to our skeleton here) or a rigged Mixamo character */
export const BODY_URL = { male: 'male_body.glb', xbot: 'models/xbot.glb', michelle: 'models/michelle.glb' };

/**
 * @param {{ canvas: HTMLCanvasElement, act: number[], modelUrl?: string, onMode?: (m: LookMode, dark: boolean) => void }} o
 *   act = per-zone muscle tint (sim/muscles.js musAct), read by the shaders every frame; onMode fires on every mode change
 *   (also when the loaded model takes over) so the UI can follow
 */
export function createStage({ canvas, act, modelUrl = import.meta.env.BASE_URL + 'male_body.glb', onMode = () => {} }) {
  let renderer = null;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { renderer = null; }
  if (!renderer) return null;
  const scene = new THREE.Scene();
  let viewH = 2.5;                                        // world units visible vertically: floor to raised hands, with margin
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 50);
  const camTarget = new THREE.Vector3(0, 0.96, 0);
  let glPR = 1, holoOn = false, moireOn = false, curMode = 'particle';   // holoOn: particle hologram, moireOn: dot-lattice body (both on the dark stage)
  renderer.setClearColor(0x000000, 0);
  const col = h => new THREE.Color(h);
  const L = new THREE.Vector3(-0.5, 0.62, 0.6).normalize();
  const U = {
    uA: { value: SEG.map(() => new THREE.Vector3()) }, uB: { value: SEG.map(() => new THREE.Vector3()) }, uR: { value: SEG.map(s => s[2]) },
    uLit: { value: col('#3a433b') }, uDark: { value: col('#1D231E') }, uRing: { value: col('#1D231E') }, uHot: { value: col('#E0704A') }, uAct: { value: act }, uL: { value: L }, uOn: { value: 1 }, uLine: { value: 0 },
    uDir: { value: new THREE.Vector3(0, 0, -1) }, uVP: { value: new THREE.Matrix4() }, uPx: { value: 0.004 },
    uFwd: { value: new THREE.Vector3(0, 0, 1) }, uHu: { value: new THREE.Vector3(0, 1, 0) }, uHf: { value: new THREE.Vector3(0, 0, 1) }
  };
  const PU = { uAct: U.uAct, uHot: U.uHot, uCol: { value: col('#EAF6FF') }, uDeep: { value: col('#2563D0') }, uArt: { value: col('#F0525A') }, uVein: { value: col('#8A4FB8') },
    uTime: { value: 0 }, uBeat: { value: 0 }, uShowB: { value: 1 }, uSize: { value: 2.1 }, uPR: { value: 1 }, uForm: { value: 1 }, uCtr: { value: new THREE.Vector3(0, 0.9, 0) } };

  const Mesh = {};
  Mesh.body = createSdfBody(U); scene.add(Mesh.body);
  const poser = createPoser();
  const particles = createParticles({ scene, PU, poser });
  Mesh.points = particles.points; Mesh.motes = particles.motes;
  const model = createBodyModel({ scene, U, poser, particles });
  /** @type {Record<string, any>} */
  const bodies = { male: model };
  let want = 'male', shown = null;                       // chosen body, and the one on screen (a loaded one; null = built-in)
  const fingK = { L: [0, 0, 0, 0, 0], R: [0, 0, 0, 0, 0] };
  const moire = createMoire({ scene, U, PU });
  Mesh.marks = moire.marks;

  // eyes and dumbbells stay ordinary meshes; the body writes real depth, so they are hidden and revealed correctly
  Mesh.head = new THREE.Group(); scene.add(Mesh.head);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xF1F0E2 });
  const eyeGeo = new THREE.SphereGeometry(0.014, 16, 12);
  for (const sg of [1, -1]) {
    const e = new THREE.Mesh(eyeGeo, eyeMat);
    // on the surface of the head ellipsoid (ANAT.head, centre pushed 1 cm forward)
    const dd = new THREE.Vector3(sg * Math.sin(0.33), 0.12, Math.cos(0.33)).normalize().multiply(new THREE.Vector3(...ANAT.head)).add(new THREE.Vector3(0, 0, 0.01));
    e.position.copy(dd); e.lookAt(dd.clone().multiplyScalar(2)); e.scale.set(0.85, 1.3, 0.5); Mesh.head.add(e);
  }
  const propMat = new THREE.MeshBasicMaterial({ color: 0x8A917D });
  for (const n of ['L', 'R']) {
    const db = new THREE.Group();
    db.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.26, 12), propMat));
    for (const s of [0.1, -0.1]) { const pl = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.055, 22), propMat); pl.position.y = s; db.add(pl); }
    scene.add(db); Mesh['db' + n] = db;
  }
  // floor: a faint disc with one hairline edge and a small mark at the world "front" (+Z)
  const fc = document.createElement('canvas'); fc.width = fc.height = 1024;
  const fg = fc.getContext('2d'); fg.translate(512, 512);
  // drawn in white and tinted by the material colour, so the same texture works on the ivory and the dark stage
  fg.fillStyle = 'rgba(255,255,255,.05)'; fg.beginPath(); fg.arc(0, 0, 504, 0, Math.PI * 2); fg.fill();
  fg.strokeStyle = 'rgba(255,255,255,.42)'; fg.lineWidth = 6; fg.beginPath(); fg.arc(0, 0, 504, 0, Math.PI * 2); fg.stroke();
  fg.strokeStyle = '#fff'; fg.lineWidth = 12; fg.beginPath(); fg.moveTo(0, 504); fg.lineTo(0, 430); fg.stroke();   // canvas bottom maps to +Z
  const ftex = new THREE.CanvasTexture(fc); ftex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.72, 96), new THREE.MeshBasicMaterial({ map: ftex, color: 0x1D231E, transparent: true, depthWrite: false }));
  floor.rotation.x = -Math.PI / 2; floor.renderOrder = -2; scene.add(floor);
  // flat contact shadow
  const shadowMesh = new THREE.Mesh(new THREE.CircleGeometry(0.36, 48), new THREE.MeshBasicMaterial({ color: 0x1D231E, opacity: 0.13, transparent: true, depthWrite: false }));
  shadowMesh.rotation.x = -Math.PI / 2; shadowMesh.position.y = 0.001; shadowMesh.renderOrder = -1; scene.add(shadowMesh);

  // the particle figure flies together out of a swirling cloud on entering the particle view (uForm 0 → 1)
  const gripK = { L: 0, R: 0 }; let gripT = 0, formT0 = 0, formDur = 1;
  const white = col('#ffffff'), _c1 = new THREE.Color();
  function color(hex) {              // dark bodies get a lighter lit side, light bodies a darker shaded side
    const c = col(hex), dark = c.r + c.g + c.b < 1.2;
    if (dark) { U.uDark.value.copy(c); U.uLit.value.copy(c).lerp(white, 0.16); }
    else { U.uLit.value.copy(c); U.uDark.value.copy(c).multiplyScalar(0.8); }
    eyeMat.color.set(dark ? '#F1F0E2' : '#1D231E');
    U.uRing.value.set(dark ? '#8A917D' : '#1D231E');
    U.uHot.value.set(hex.toUpperCase() === '#E0704A' ? '#1D231E' : '#E0704A');   // keep the muscle tint visible on an orange body
    PU.uCol.value.set(dark ? '#EAF6FF' : hex);           // particles need a light colour to show on the dark stage
    if (hex.toUpperCase() === '#E0704A') U.uHot.value.set('#F1F0E2');
  }
  function reform(dur) { formT0 = -1; formDur = dur; }
  // 'solid' = the one-piece body on the ivory stage; 'particle' = the point hologram on a dark stage;
  // 'moire' = the model covered in a fine dot lattice whose moiré flows as the body moves, also on the dark stage
  function mode(m) {
    if (m === 'particle' && !holoOn) reform(2.4);
    curMode = m; holoOn = m === 'particle'; moireOn = m === 'moire';
    const cur = shown && bodies[shown], meshOn = !!cur, dark = holoOn || moireOn;   // a loaded model replaces the built-in solid shape
    Mesh.body.visible = Mesh.head.visible = !holoOn && !meshOn; Mesh.points.visible = Mesh.motes.visible = holoOn;
    for (const k in bodies) {
      const b = bodies[k]; if (!b.loaded) continue;
      b.solid.visible = b === cur && !holoOn; b.solidLine.visible = false;
      if (b === cur) b.solid.material = moireOn ? moire.mat : model.meshMat;
    }
    Mesh.marks.visible = moireOn && meshOn;
    floor.material.color.set(dark ? '#BDE6EA' : '#1D231E'); floor.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending; floor.material.needsUpdate = true;
    shadowMesh.material.color.set(dark ? '#BDE6EA' : '#1D231E'); shadowMesh.material.opacity = dark ? 0.07 : 0.13;
    propMat.color.set(dark ? '#5d6f72' : '#8A917D');
    onMode(m, dark);
  }
  /** per-frame uniforms and skinning; poses the body first, so place() can put the dumbbells in its hands */
  function look({ sol, shade, line, oxy, beat, hr, spo2, smo2, now }) {
    U.uOn.value = shade ? 1 : 0; U.uLine.value = line ? 1 : 0; shadowMesh.visible = shade;
    const cur = shown && bodies[shown];
    if (cur) cur.solidLine.visible = line && !holoOn && !moireOn;
    moire.MU.uSp.value = MOIRE_PX * U.uPx.value;          // lattice pitch in device pixels, as on the globe
    PU.uTime.value = (now / 1000) % 1000; PU.uPR.value = glPR;
    if (formT0 < 0) formT0 = now;
    PU.uForm.value = clamp((now - formT0) / 1000 / formDur, 0, 1);
    if (sol) PU.uCtr.value.set(sol.P.pel.x, sol.P.pel.y + 0.12, sol.P.pel.z);
    // heartbeat: a strong "lub" then a softer "dub" in each cycle, paced by the (estimated or measured) heart rate
    const ph = beat % 1;
    PU.uBeat.value = ph < 0.12 ? Math.sin(ph / 0.12 * Math.PI) : ph < 0.3 ? 0.45 * Math.sin((ph - 0.12) / 0.18 * Math.PI) : 0;
    PU.uShowB.value = oxy ? 1 : 0;
    // blood oxygen: arteries darken as SpO2 falls, veins turn bluer as the muscles take more oxygen (both simulated, see sim/bio.js)
    PU.uArt.value.set('#7E2635').lerp(_c1.set('#F0525A'), clamp((spo2 - 92) / 7, 0, 1));
    PU.uVein.value.set('#4C46C8').lerp(_c1.set('#A04C86'), clamp((smo2 - 35) / 36, 0, 1));
    poser.clearPosed();
    const gdt = Math.min(0.1, Math.max(0, (now - gripT) / 1000)); gripT = now;   // hands close around the dumbbells over ~0.2 s
    // each hand: closed around a dumbbell, or as closed as the tracked hand (camera hand tracking)
    // each finger of a rigged model: the grip, or its own curl while hand tracking sees it
    const ga = 1 - Math.exp(-gdt / 0.08);
    for (const n of ['L', 'R']) {
      const held = sol && sol.prop ? 1 : 0, g = (sol && sol.grip && sol.grip[n]) || 0, fc = sol && sol.fingers && sol.fingers[n];
      gripK[n] += (Math.max(held, g) - gripK[n]) * ga;
      for (let f = 0; f < 5; f++) fingK[n][f] += (Math.max(held, fc ? fc[f] : g) - fingK[n][f]) * ga;
    }
    const time = (now / 1000) % 1000, flow = 0.25 + hr / 60 * 0.2;
    if (sol && cur) cur.frame(sol.P, sol.D, cur === model ? gripK : fingK, holoOn, time, flow);
    else if (sol && holoOn) particles.skin(sol.P, sol.D, time, flow, gripK);
    if (sol && moireOn) moire.place(mapP(sol.P), sol.D);
  }

  // overlay size in device pixels (the 2D canvas over the stage), and the GL pixel ratio cap: the ray-marched body
  // is fill-rate bound, and drops to 1× if the GPU cannot keep up (checked once, after the first few seconds)
  let W = 1, H = 1, dpr = 1, glCap = 1.5, cssW = 1, cssH = 1;
  /** @param {number} width @param {number} height  CSS pixels of the stage canvases @param {number} pixelRatio */
  function resize(width, height, pixelRatio) {
    cssW = width; cssH = height; dpr = pixelRatio;
    W = Math.max(1, Math.round(width * dpr)); H = Math.max(1, Math.round(height * dpr));
    glPR = Math.min(dpr, glCap);
    renderer.setPixelRatio(glPR); renderer.setSize(width, height, false);
    const a = W / H;
    viewH = Math.max(2.5, 1.9 / a);
    camera.left = -viewH * a / 2; camera.right = viewH * a / 2; camera.top = viewH / 2; camera.bottom = -viewH / 2; camera.updateProjectionMatrix();
    U.uPx.value = viewH / Math.max(1, height * glPR);
  }
  let slowN = 0, slowT = 0;
  function watchPerf(dtRaw) {
    if (glCap <= 1 || slowN < 0) return;
    slowN++; slowT += dtRaw;
    if (slowN === 150) { if (slowT / slowN > 0.03) { glCap = 1; resize(cssW, cssH, dpr); } slowN = -1; }
  }

  const Yv = new THREE.Vector3(0, 1, 0), tv = new THREE.Vector3(), mtx = new THREE.Matrix4();
  const T = p => new THREE.Vector3(p.x, p.y, p.z);
  function basis(m, up, fw) {
    const u = T(nrm(up)), f0 = T(fw); f0.sub(u.clone().multiplyScalar(f0.dot(u))).normalize();
    mtx.makeBasis(new THREE.Vector3().crossVectors(u, f0), u, f0); m.quaternion.setFromRotationMatrix(mtx);
  }
  function place(s) {            // call after the camera has been positioned for this frame
    const { P, D } = s;
    SEG.forEach((g, i) => { U.uA.value[i].copy(P[g[0]]); U.uB.value[i].copy(P[g[1]]); });
    U.uFwd.value.set(D.bodyF.x, D.bodyF.y, D.bodyF.z); U.uHu.value.set(D.hu.x, D.hu.y, D.hu.z); U.uHf.value.set(D.hf.x, D.hf.y, D.hf.z);
    camera.updateMatrixWorld(); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    U.uVP.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    camera.getWorldDirection(U.uDir.value);
    Mesh.body.position.set(P.pel.x, 1.1, P.pel.z); Mesh.body.quaternion.copy(camera.quaternion);
    Mesh.head.position.copy(T(P.head)); basis(Mesh.head, D.hu, D.hf);
    for (const n of ['L', 'R']) {
      const db = Mesh['db' + n]; db.visible = s.prop;
      if (!s.prop) continue;
      const cur = shown && bodies[shown];
      if (!(cur ? cur.gripOf(n, db.position, tv) : poser.gripOf(n, db.position, tv))) { db.position.copy(T(P['hand' + n])); tv.set(D.side.x, D.side.y, D.side.z); }
      db.quaternion.setFromUnitVectors(Yv, tv);
    }
    shadowMesh.position.set(P.pel.x, 0.001, P.pel.z);
    const k = 1 - clamp(s.jump * 2.5, 0, 0.35); shadowMesh.scale.set(k, k, 1);
  }
  /**
   * one frame: camera on its orbit, body uniforms + skinning, placement, render
   * @param {{ sol: import('../core/skeleton.js').Solved, camYaw: number, camPitch: number, shade: boolean, line: boolean, oxy: boolean,
   *   beat: number, hr: number, spo2: number, smo2: number, now: number }} f
   */
  function render(f) {
    const dist = 8;
    camera.position.set(camTarget.x + Math.sin(f.camYaw) * Math.cos(f.camPitch) * dist, camTarget.y + Math.sin(f.camPitch) * dist, camTarget.z + Math.cos(f.camYaw) * Math.cos(f.camPitch) * dist);
    camera.lookAt(camTarget);
    look(f);
    place(f.sol);
    renderer.render(scene, camera);
  }
  const pv = new THREE.Vector3();
  /** world point → overlay pixel (device pixels of the 2D canvas) */
  function project(p) { pv.set(p.x, p.y, p.z).project(camera); return { x: (pv.x + 1) / 2 * W, y: (1 - pv.y) / 2 * H }; }

  /** the skeleton's joints where the shown model has them (overlay, markers); unchanged for male_body.glb */
  function mapP(P) { const cur = shown && bodies[shown]; return cur && cur.mapP && P ? cur.mapP(P) : P; }
  /** show the chosen body if it has loaded, else male_body.glb if that has, else the built-in shapes */
  function refresh() {
    if (disposed) return;                         // a model load that finished after dispose()
    shown = bodies[want] && bodies[want].loaded ? want : model.loaded ? 'male' : null;
    if (shown) bodies[shown].activate(); else particles.use(particles.procedural);
    mode(curMode);
  }
  /**
   * switch the body model; a rigged one is loaded the first time (the current body stays until it is ready)
   * @param {BodyKey} key @returns {Promise<void>}
   */
  async function setBody(key) {
    if (!(key in BODY_URL)) key = 'male';
    want = key;
    if (!bodies[key]) bodies[key] = createRiggedModel({ scene, meshMat: model.meshMat, lineMat: model.meshLineMat, particles, PU });
    const b = bodies[key];
    if (!b.loaded && b !== model) {               // male_body.glb is loading from the start anyway
      if (!b.loading) b.loading = b.load(import.meta.env.BASE_URL + BODY_URL[key]).finally(() => { b.loading = null; });
      try { await b.loading; } catch (e) { console.warn(BODY_URL[key] + ' not loaded', e); }
    }
    if (want === key) refresh();
  }
  let disposed = false;
  /** the canvas is going away: losing the context frees every GPU resource at once; the JS objects go with the stage */
  function dispose() { disposed = true; renderer.dispose(); renderer.forceContextLoss(); }

  mode('particle');
  model.load(modelUrl).then(refresh).catch(e => console.warn('male_body.glb not loaded; using the built-in body shape', e));   // switch the solid / moiré view over to the mesh
  return {
    color, mode, reform, resize, watchPerf, render, project, setBody, mapP, dispose,
    /** @returns {LookMode} */
    get current() { return curMode; },
    /** the stage is dark (particle and moiré views) */
    get dark() { return holoOn || moireOn; },
    /** world units visible vertically, and overlay size in device pixels */
    get view() { return { viewH, W, H, dpr }; }
  };
}
