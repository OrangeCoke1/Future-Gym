import * as THREE from 'three';
import { buildCapsule } from './capsule.js';
import { FLIGHT_END, INTRO_END, flightAt, phaseAt, stationRevealAt } from './timeline.js';
import { createCamRig, frameCapsule } from './camRig.js';
import { buildGymRoom } from './gymRoom.js';
import { ACCENT, color, createEquipmentMaterials } from './materials.js';
import { createBloom, createEnvironment, supportsHdr } from './post.js';
import { buildStation, createBayMaterials } from './stationMesh.js';
import { STATIONS } from './stations.js';
import { createLobbyTextures } from './textures.js';

/** @typedef {{ id: string, x: number, y: number, visible: boolean }} LabelPosition */

/**
 * @param {{
 *   canvas: HTMLCanvasElement, reduced: boolean, skipIntro: boolean,
 *   onReady: () => void, onReveal: (opacity: number) => void, onHover: (id: string|null) => void,
 *   onPick: (station: import('./stations.js').Station) => void, onLabels: (labels: LabelPosition[]) => void,
 *   onUnavailable: () => void, onDepart: () => void, onFade: (opacity: number) => void
 * }} options
 */
export function createLobby({
  canvas, reduced, skipIntro, onReady, onReveal, onHover, onPick, onLabels, onUnavailable, onDepart, onFade,
}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  } catch {
    return null;
  }
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.physicallyCorrectLights = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;

  const memory = navigator.deviceMemory;
  const canBloom = renderer.capabilities.isWebGL2 && supportsHdr(renderer);
  const suitedForHigh = w => w >= 860 && (memory === undefined || memory >= 4) && canBloom;
  const detailed = suitedForHigh(canvas.clientWidth);
  const textures = createLobbyTextures(detailed);
  const materials = createEquipmentMaterials(textures);
  const bayMaterials = createBayMaterials(textures);
  const environment = createEnvironment(renderer);
  const scene = new THREE.Scene();
  const intro = new THREE.Scene();
  scene.environment = intro.environment = environment?.texture ?? null;
  const key = buildGymRoom(scene, textures, materials, detailed);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 45);
  const rig = createCamRig(camera);
  const accent = color(getComputedStyle(document.documentElement).getPropertyValue('--acc').trim() || ACCENT);
  const stations = STATIONS.map(station => buildStation(station, { detailed, materials, bayMaterials, textures, accent }));
  scene.add(...stations.map(s => s.group));

  let introTime = reduced || skipIntro ? INTRO_END : 0;
  let ready = introTime === INTRO_END;
  let inRoom = ready;
  if (inRoom) canvas.classList.add('is-in-room');
  let capsule = ready ? null : buildCapsule(intro, textures, detailed);
  const introCamera = new THREE.PerspectiveCamera(36, 1, 0.038, 70);
  const overlay = new THREE.Scene();
  const screenCamera = new THREE.Camera();
  let flash = capsule ? new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
  })) : null;
  const warmWhite = color('#FFF8EE');
  if (flash) overlay.add(flash);

  const colliders = stations.map(s => s.collider);
  const labels = STATIONS.map(({ id }) => ({ id, x: 0, y: 0, visible: false }));
  const projected = new THREE.Vector3();
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hits = [];
  let width = 0, height = 0, raf = null, last = null, time = 0, disposed = false;
  let drag = null, active = null, focus = null, hover = null, mouse = null;
  let flight = null;
  let high = false, autoLow = false, bloom, sampledSeconds = 0, sampledFrames = 0;

  function updateHighlight() {
    const id = focus ?? hover;
    if (id === active) return;
    active = id;
    onHover(id);
  }

  function highlight(id) {
    focus = id;
    updateHighlight();
  }

  function pickById(id) {
    if (!ready || flight) return;
    const station = STATIONS.find(s => s.id === id);
    if (!station) return;
    if (reduced) {
      onPick(station);
      return;
    }
    flight = { station, start: time, frame: rig.flightTo(station), sent: false };
    drag = null;
    rig.release();
    leave();
    highlight(null);
    onDepart();
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

  function disposeBloom() {
    bloom?.dispose();
    bloom = null;
  }

  function resizeRenderer() {
    const next = suitedForHigh(width) && !autoLow;
    if (next !== high) {
      high = next;
      renderer.shadowMap.enabled = high;
      renderer.shadowMap.needsUpdate = high;
      for (const station of stations) station.quality(high);
      if (!high) {
        disposeBloom();
        key.shadow.dispose();
        key.shadow.map = null;
      }
    }
    renderer.setPixelRatio(high ? Math.min(window.devicePixelRatio || 1, 1.75) : 1);
    renderer.setSize(width, height, false);
    bloom?.resize(width, height);
  }

  function render(world, view, dt) {
    if (!high) {
      renderer.render(world, view);
      return;
    }
    if (!bloom) {
      bloom = createBloom(renderer, world, view);
      bloom.resize(width, height);
    }
    bloom.render(world, view, dt);
  }

  function showRoom() {
    inRoom = true;
    canvas.classList.add('is-in-room');
    renderer.shadowMap.needsUpdate = high;
  }

  function revealRoom() {
    if (ready) return;
    ready = true;
    introTime = INTRO_END;
    if (!inRoom) showRoom();
    freeIntro();
    onReveal(1);
    onReady();
  }

  function updateEquipment(dt, progress = 0, entering = false) {
    for (const [i, station] of stations.entries()) {
      const id = STATIONS[i].id;
      const reveal = entering ? stationRevealAt(introTime, i) : 1;
      const beamFocus = flight ? (flight.station.id === id ? 0.6 : -0.5) * progress : 0;
      const moved = station.update(dt, time, reveal, id === active, beamFocus, high, reduced);
      if (moved && high) renderer.shadowMap.needsUpdate = true;
    }
  }

  function drawIntro(dt) {
    const phase = phaseAt(introTime);
    if (phase.ready && inRoom) {
      revealRoom();
      return false;
    }
    onReveal(phase.reveal);
    const cutting = phase.room && !inRoom;
    if (phase.room) {
      if (cutting) showRoom();
      rig.apply(dt, phase.pullback);
      updateEquipment(dt, 0, true);
      render(scene, camera, dt);
    } else {
      capsule.update(introTime, phase);
      frameCapsule(introCamera, width / height, phase, capsule.pod);
      render(intro, introCamera, dt);
    }

    const opacity = cutting ? 1 : Math.max(phase.flash, 1 - phase.fadeIn);
    if (opacity > 0) {
      flash.material.color.copy(warmWhite).multiplyScalar(Number(phase.fadeIn === 1));
      flash.material.opacity = opacity;
      renderer.autoClear = false;
      renderer.render(overlay, screenCamera);
      renderer.autoClear = true;
    }
    return true;
  }

  function draw(dt) {
    if (!ready && drawIntro(dt)) return;
    if (flight) {
      const elapsed = time - flight.start;
      const { position, fade } = flightAt(elapsed);
      flight.frame(position);
      updateEquipment(dt, position);
      onFade(fade);
      render(scene, camera, dt);
      if (elapsed >= FLIGHT_END && !flight.sent) {
        flight.sent = true;
        onPick(flight.station);
      }
      return;
    }
    rig.apply(dt, 1, reduced);
    updateEquipment(dt);
    render(scene, camera, dt);
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
    if (high && dt > 0 && sampledSeconds < 2) {
      sampledSeconds += dt;
      sampledFrames++;
      if (sampledSeconds >= 2 && sampledSeconds / sampledFrames > 0.028) {
        autoLow = true;
        resizeRenderer();
      }
    }
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
    w = Math.max(1, w);
    h = Math.max(1, h);
    if (w === width && h === height) return;
    width = w;
    height = h;
    resizeRenderer();
    rig.resize(width / height);
    if (!document.hidden) draw(0);
  }

  function skip() {
    if (ready) return;
    revealRoom();
    if (!document.hidden) draw(0);
  }

  function reset() {
    flight = null;
    onFade(0);
  }

  function down(event) {
    if (!ready || flight || drag || event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, moved: false };
    canvas.setPointerCapture(event.pointerId);
    canvas.style.cursor = 'grabbing';
  }

  function move(event) {
    if (!ready || flight) return;
    if (event.pointerType === 'mouse') mouse = { x: event.clientX, y: event.clientY };
    if (drag?.id !== event.pointerId) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    if (!drag.moved) {
      hover = null;
      updateHighlight();
    }
    drag.moved = true;
    rig.drag(dx - drag.dx, dy - drag.dy);
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
      disposeBloom();
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

  function free(...worlds) {
    const resources = new Set();
    for (const world of worlds) {
      world.traverse(obj => {
        if (obj.geometry) resources.add(obj.geometry);
        if (obj.shadow) resources.add(obj.shadow);
        if (obj.material) {
          for (const material of [obj.material].flat()) resources.add(material);
        }
      });
      world.clear();
    }
    for (const resource of resources) resource.dispose();
  }

  function freeIntro() {
    if (!capsule) return;
    free(intro, overlay);
    capsule = flash = null;
    intro.environment = null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
    for (const [name, fn] of Object.entries(events)) canvas.removeEventListener(name, fn);
    document.removeEventListener('visibilitychange', visibility);
    for (const station of stations) station.dispose();
    disposeBloom();
    free(scene);
    freeIntro();
    textures.dispose();
    environment?.dispose();
    renderer.dispose();
    if (!renderer.getContext().isContextLost()) renderer.forceContextLoss();
  }

  return { start, stop, resize, skip, highlight, pickById, reset, dispose };
}
