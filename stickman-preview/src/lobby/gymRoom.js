import * as THREE from 'three';
import { buildCity } from './cityScene.js';
import { ACCENT, DECK, GLOW, WALL, color, lightMaterial, surface } from './materials.js';
import { ROOM, WINDOW } from './layout.js';
import { buildWallFixtures } from './props/wallFixtures.js';
import { beveledPanel, chamferedShape, createPropBatch, lathe, roundedBorder, roundedShape } from './props/geometry.js';

function cabinShell(detailed) {
  const { halfWidth: w, height: h, back, front } = ROOM;
  const radius = 0.54, steps = detailed ? 14 : 7;
  const profile = [[-w, 0]];
  for (const side of [-1, 1]) {
    for (let i = 0; i <= steps; i++) {
      const a = Math.PI * (0.25 - side * (i / steps - 0.5) / 2);
      profile.push([side * (w - radius + radius * Math.cos(a)), h - radius + radius * Math.sin(a)]);
    }
  }
  profile.push([w, 0]);

  const vertices = [], uvs = [], faces = [];
  let length = 0;
  for (const [i, [x, y]] of profile.entries()) {
    if (i) length += Math.hypot(x - profile[i - 1][0], y - profile[i - 1][1]);
    vertices.push(x, y, back, x, y, front);
    uvs.push(length, 0, length, 1);
    if (i) faces.push(i * 2 - 2, i * 2, i * 2 - 1, i * 2, i * 2 + 1, i * 2 - 1);
  }
  for (let i = 0; i < uvs.length; i += 2) uvs[i] /= length;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

function cutWindow(shape, x, y, margin, depth, bevel) {
  const { width, height, radius } = WINDOW;
  const hole = roundedShape(width + margin, height + margin, radius + margin / 2);
  const offset = new THREE.Vector2(x, y);
  shape.holes.push(new THREE.Path(hole.getPoints(10).map(point => point.add(offset))));
  return beveledPanel(shape, depth, bevel);
}

function addWindow(scene, materials, guard, detailed) {
  const group = new THREE.Group();
  group.name = 'city-window';
  group.position.set(WINDOW.x, WINDOW.y, ROOM.back + 0.058);
  const batch = createPropBatch(group, detailed);

  batch.add(cutWindow(chamferedShape(4.78, 2.30, 0.22), 0, 0, 0.02, 0.174, 0.021),
    materials.housing, [0, 0, 0]);
  batch.add(roundedBorder(4.64, 2.171, 0.247, 0.051, detailed), materials.graphite, [0, 0, 0.153]);
  batch.add(roundedBorder(4.54, 2.071, 0.196, 0.021, detailed), materials.chrome, [0, 0, 0.158]);
  for (const side of [-1, 1]) {
    for (const vertical of [-1, 1]) {
      batch.add(beveledPanel(chamferedShape(0.36, 0.135, 0.045), 0.056, 0.012),
        guard, [side * 2.283, vertical * 1.021, 0.13], [0, 0, -side * vertical * Math.PI / 4]);
    }
  }

  batch.finish();
  scene.add(group);
}

function addArmor(scene, textures, materials, guard, detailed) {
  const batch = createPropBatch(scene, detailed);
  for (const side of [-1, 1]) {
    const x = side * 2.9;
    batch.box(materials.graphite, [0.123, 2.92, 0.119], [x, 1.55, ROOM.back + 0.10], 0.019);
    for (const y of [0.19, 2.92]) {
      batch.box(guard, [0.183, 0.17, 0.143], [x, y, ROOM.back + 0.15], 0.023);
    }
    batch.box(materials.graphite, [0.093, 0.14, ROOM.front - ROOM.back - 0.24],
      [side * 2.995, 0.088, (ROOM.front + ROOM.back) / 2], 0.023);
  }
  batch.add(beveledPanel(chamferedShape(1.18, 0.141, 0.035), 0.054, 0.010),
    materials.housing, [0.33, 3.355, ROOM.back + 0.12]);
  const wordmark = new THREE.MeshBasicMaterial({
    map: textures.wordmark(), transparent: true, depthWrite: false, toneMapped: false,
  });
  batch.add(new THREE.PlaneGeometry(1.07, 0.44), wordmark, [0.33, 3.355, ROOM.back + 0.162]);
  batch.finish();
}

function addLightingSlots(scene, textures, materials, lamp, detailed) {
  const { halfWidth: w, height: h, back, front } = ROOM;
  const batch = createPropBatch(scene, detailed);
  const ring = new THREE.Group();
  ring.name = 'ceiling-ring';
  ring.position.set(0, h, -0.55);
  const ringParts = createPropBatch(ring, detailed);
  const segments = detailed ? 96 : 56;
  const down = [Math.PI / 2, 0, 0];
  ringParts.add(lathe([
    [0, -0.094], [0.855, -0.094], [0.903, -0.123], [0.926, -0.104], [1.027, -0.104],
    [1.051, -0.133], [1.095, -0.126], [1.140, -0.088], [1.153, -0.038], [1.153, 0.039], [0, 0.039],
  ], segments), materials.housing, [0, 0, 0]);
  ringParts.add(new THREE.RingGeometry(0.911, 1.047, segments), materials.graphite, [0, -0.122, 0], down);
  ringParts.add(new THREE.TorusGeometry(0.976, 0.017, 8, segments), lamp, [0, -0.125, 0], down);
  for (let i = 0; i < 6; i++) {
    const angle = i * Math.PI / 3 + Math.PI / 12;
    ringParts.cylinder(materials.graphite, 0.014, 0.007, [1.073 * Math.cos(angle), -0.132, 1.073 * Math.sin(angle)]);
  }
  ringParts.finish();
  for (const part of ring.children) part.castShadow = false;
  scene.add(ring);

  const x = w - 0.47;
  const span = front - back;
  const y = h - 0.026;
  const turn = [[-x, y, back + 0.50], [-x + 0.09, y, back + 0.23],
    [-x + 0.38, y, back + 0.082], [0, y, back + 0.061], [x - 0.38, y, back + 0.082],
    [x - 0.09, y, back + 0.23], [x, y, back + 0.50]];
  const z = (front + back + 0.35) / 2;
  for (const side of [-1, 1]) {
    batch.box(materials.graphite, [0.067, 0.033, span - 0.65], [side * x, y, z], 0.012);
    batch.box(lamp, [0.012, 0.011, span - 0.65], [side * x, y - 0.019, z], 0.004);
    batch.box(materials.graphite, [0.043, 0.066, span - 0.09], [side * (w - 0.025), 0.037, (front + back) / 2], 0.011);
    batch.box(lamp, [0.011, 0.013, span - 0.09], [side * (w - 0.048), 0.037, (front + back) / 2], 0.004);
  }
  batch.tube(materials.graphite, turn, 0.027);
  batch.tube(lamp, turn.map(([x, y, z]) => [x, y - 0.024, z]), 0.009);
  batch.box(materials.graphite, [w * 2 - 0.08, 0.066, 0.045], [0, 0.037, back + 0.026], 0.012);
  batch.box(lamp, [w * 2 - 0.115, 0.013, 0.012], [0, 0.037, back + 0.050], 0.004);

  const wash = lightMaterial(GLOW, 1, { map: textures.wash(), transparent: true, depthWrite: false, opacity: 0.63 });
  for (const side of [-1, 1]) {
    batch.add(new THREE.PlaneGeometry(0.42, span), wash,
      [side * (w - 0.22), 0.002, (back + front) / 2], [-Math.PI / 2, 0, side === 1 ? Math.PI : 0]);
  }
  batch.add(new THREE.PlaneGeometry(0.38, w * 2), wash, [0, 0.0025, back + 0.20], [-Math.PI / 2, 0, -Math.PI / 2]);
  batch.finish();
}

function addRoomLights(scene) {
  const bounce = new THREE.HemisphereLight(color('#EDF5FF'), color('#7488A7'), 1.38);
  const ambient = new THREE.AmbientLight(color('#E3EAF4'), 0.88);
  const key = new THREE.DirectionalLight(color('#F5F7FF'), 1.76);
  key.position.set(-1.7, 6, 3.3);
  key.target.position.set(0, 0, -1.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4.7, right: 4.7, top: 4.8, bottom: -4.8, near: 0.25, far: 15 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.016;
  key.shadow.radius = 4;

  const fill = new THREE.PointLight(color('#A3C0D4'), 7, 9, 2);
  fill.position.set(0.44, 2.235, ROOM.back + 0.61);
  scene.add(ambient, bounce, key, key.target, fill);
  return key;
}

export function buildGymRoom(scene, textures, materials, detailed) {
  const { halfWidth, height, back, front } = ROOM;
  scene.background = color(WALL);
  const seams = textures.panels();
  const wall = surface(WALL, {
    map: seams, bumpMap: seams, bumpScale: 0.0025, side: THREE.DoubleSide, roughness: 0.51, envMapIntensity: 0.57,
  });
  const shell = new THREE.Mesh(cabinShell(detailed), wall);
  // The shell lights are inside the room, so only interior objects cast shadows.
  shell.receiveShadow = true;
  const bulkheadGeometry = cutWindow(roundedShape(halfWidth * 2, height, 0.061),
    WINDOW.x, WINDOW.y - height / 2, 0.10, 0.13, 0.008);
  const { uv, position } = bulkheadGeometry.attributes;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / (2 * halfWidth) + 0.5, position.getY(i) / height + 0.5);
  const bulkhead = new THREE.Mesh(bulkheadGeometry, wall);
  bulkhead.position.set(0, height / 2, back - 0.065);
  bulkhead.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfWidth * 2, front - back), surface(DECK, {
    map: textures.floor(), roughness: 0.32, envMapIntensity: 0.54,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = (back + front) / 2;
  floor.receiveShadow = true;
  scene.add(shell, bulkhead, floor, buildCity(detailed));

  const lamp = lightMaterial(GLOW, 2.55);
  const guard = surface(ACCENT, { roughness: 0.36, metalness: 0.18 });
  addWindow(scene, materials, guard, detailed);
  addArmor(scene, textures, materials, guard, detailed);
  addLightingSlots(scene, textures, materials, lamp, detailed);
  const { coach, menu } = buildWallFixtures(scene, { textures, materials, lamp, detailed });
  return { key: addRoomLights(scene), coach, menu };
}
