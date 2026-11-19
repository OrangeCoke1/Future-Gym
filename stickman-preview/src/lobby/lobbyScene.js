import * as THREE from 'three';
import { buildCapsule } from './capsule.js';
import { INTRO_END, phaseAt, stationRevealAt } from './timeline.js';
import { createCamRig, frameCapsule } from './camRig.js';
import { DARK, buildGymRoom, lightRoom } from './gymRoom.js';
import { buildStation } from './stationMesh.js';
import { STATIONS } from './stations.js';

/**
 * @typedef {{ id: string, x: number, y: number, visible: boolean }} LabelPosition
 * @param {{
 *   canvas: HTMLCanvasElement, reduced: boolean, skipIntro: boolean,
 *   onReady: () => void, onReveal: (opacity: number) => void, onHover: (id: string|null) => void,
 *   onPick: (station: import('./stations.js').Station) => void, onLabels: (labels: LabelPosition[]) => void,
 *   onUnavailable: () => void
 * }} options
 */
export function createLobby({ canvas, reduced, skipIntro, onReady, onReveal, onHover, onPick, onLabels, onUnavailable }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  const dust = buildGymRoom(scene);
  const camera = new THREE.PerspectiveCamera(44, 1, 0.05, 42);
  const rig = createCamRig(camera);
  const stations = STATIONS.map(buildStation);
  scene.add(...stations.map(s => s.group));

  let introTime = reduced || skipIntro ? INTRO_END : 0;
  let ready = introTime === INTRO_END;
  const intro = new THREE.Scene();
  const blend = new THREE.Scene();
  const introCamera = new THREE.PerspectiveCamera(36, 1, 0.045, 28);
  const screenCamera = new THREE.Camera();
  const target = ready ? null : new THREE.WebGLRenderTarget(1, 1);
  let animateCapsule;
  if (target) {
    intro.background = new THREE.Color(DARK);
    lightRoom(intro);
    animateCapsule = buildCapsule(intro);
    blend.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
      map: target.texture, transparent: true, depthTest: false, depthWrite: false,
    })));
  }

  const cold = new THREE.Color('#9ce4ed');
  const hot = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || '#E0704A');
  const colliders = stations.map(s => s.collider);
  const labels = STATIONS.map(({ id }) => ({ id, x: 0, y: 0, visible: false }));
  const projected = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hits = [];
  let width = 1, height = 1, raf = null, last = null, time = 0, disposed = false;
  let drag = null, active = null, focus = null, hover = null, mouse = null;

  function updateHighlight() {
    const id = focus ?? hover;
    if (id === active) return;
    active = id;
    for (const [i, s] of stations.entries()) {
      const lit = STATIONS[i].id === id;
      s.ring.color.copy(lit ? hot : cold);
      s.beacon.color.copy(s.ring.color);
      s.beacon.opacity = lit ? 0.65 : 0.25;
    }
    onHover(id);
  }

  function highlight(id) {
    focus = id;
    updateHighlight();
  }

  function pickById(id) {
    const station = STATIONS.find(s => s.id === id);
    if (station && ready) onPick(station);
  }

  function hitAt(x, y) {
    const rect = canvas.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    pointer.set(2 * (x - rect.left) / width - 1, 1 - 2 * (y - rect.top) / height);
    raycaster.setFromCamera(pointer, camera);
    hits.length = 0;
    raycaster.intersectObjects(colliders, false, hits);
    return hits[0]?.object.userData.station ?? null;
  }

  function revealRoom() {
    if (ready) return;
    ready = true;
    introTime = INTRO_END;
    for (const s of stations) s.group.position.y = 0;
    onReveal(1);
    onReady();
  }

  function drawIntro(dt) {
    const phase = phaseAt(introTime);
    if (phase.ready) {
      revealRoom();
      return false;
    }
    onReveal(phase.reveal);
    if (phase.dolly < 1) {
      frameCapsule(introCamera, width / height, phase.dolly);
      animateCapsule(introTime, phase);
    }
    if (phase.dolly === 0) {
      renderer.render(intro, introCamera);
    } else {
      rig.apply(dt, (1 - phase.dolly) * 1.7);
      for (const [i, s] of stations.entries()) s.group.position.y = (stationRevealAt(introTime, i) - 1) * 2.2;
      if (phase.dolly < 1) {
        renderer.setRenderTarget(target);
        renderer.render(intro, introCamera);
        renderer.setRenderTarget(null);
      }
      renderer.render(scene, camera);
      if (phase.dolly < 1) {
        blend.children[0].material.opacity = 1 - phase.dolly;
        renderer.autoClear = false;
        renderer.render(blend, screenCamera);
        renderer.autoClear = true;
      }
    }
    return true;
  }

  function draw(dt) {
    if (!ready && drawIntro(dt)) return;
    rig.apply(dt);
    if (!reduced) dust.rotation.y = Math.sin(time * 0.09) * 0.14;
    renderer.render(scene, camera);
    if (mouse && !drag) {
      hover = hitAt(mouse.x, mouse.y);
      canvas.style.cursor = hover ? 'pointer' : 'grab';
      updateHighlight();
    }
    for (const [i, s] of stations.entries()) {
      s.anchor.getWorldPosition(projected).project(camera);
      const label = labels[i];
      label.x = (projected.x + 1) * width * 0.5;
      label.y = (1 - projected.y) * height * 0.5;
      label.visible = Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && Math.abs(projected.z) < 1;
    }
    onLabels(labels);
  }

  function tick(now) {
    const dt = last === null ? 0 : (now - last) / 1000;
    last = now;
    time += dt;
    if (!ready) introTime += dt;
    draw(dt);
    raf = requestAnimationFrame(tick);
  }

  function start() {
    if (raf === null && !disposed && !document.hidden) raf = requestAnimationFrame(tick);
  }

  function stop() {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = last = null;
  }

  function resize(w, h) {
    width = Math.max(1, w);
    height = Math.max(1, h);
    renderer.setPixelRatio(width < 860 ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    rig.resize(width / height);
    if (!ready) target.setSize(Math.ceil(width), Math.ceil(height));
    if (!document.hidden) draw(0);
  }

  function skip() {
    if (ready) return;
    revealRoom();
    if (!document.hidden) draw(0);
  }

  function down(event) {
    if (!ready || drag || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }

  function move(event) {
    if (event.pointerType === 'mouse') mouse = { x: event.clientX, y: event.clientY };
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      hover = null;
      updateHighlight();
    }
    drag.moved = true;
    if (!reduced) rig.drag(dx - drag.dx, dy - drag.dy);
    drag.dx = dx;
    drag.dy = dy;
  }

  function release(event) {
    if (drag?.id !== event.pointerId) return;
    const tap = !drag.moved && Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6;
    drag = null;
    rig.release();
    canvas.style.cursor = 'grab';
    if (tap && event.type === 'pointerup') pickById(hitAt(event.clientX, event.clientY));
  }

  function leave() {
    mouse = hover = null;
    updateHighlight();
  }

  function visibility() {
    if (document.hidden) {
      drag = null;
      rig.release();
      leave();
      stop();
    } else start();
  }

  function contextLost() {
    dispose();
    onUnavailable();
  }

  const events = {
    pointerdown: down, pointermove: move, pointerup: release, pointercancel: release,
    lostpointercapture: release, pointerleave: leave, webglcontextlost: contextLost,
  };
  for (const [name, fn] of Object.entries(events)) canvas.addEventListener(name, fn);
  document.addEventListener('visibilitychange', visibility);

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    for (const [name, fn] of Object.entries(events)) canvas.removeEventListener(name, fn);
    document.removeEventListener('visibilitychange', visibility);
    const resources = new Set();
    const collect = obj => {
      if (obj.geometry) resources.add(obj.geometry);
      if (!obj.material) return;
      resources.add(obj.material);
      for (const value of Object.values(obj.material)) if (value?.isTexture && value !== target?.texture) resources.add(value);
    };
    for (const world of [scene, intro, blend]) world.traverse(collect);
    target?.dispose();
    for (const res of resources) res.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { start, stop, resize, skip, highlight, pickById, dispose };
}
