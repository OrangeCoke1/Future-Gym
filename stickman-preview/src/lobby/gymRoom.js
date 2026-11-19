import * as THREE from 'three';
import { DECK, LILAC, WALL, color, lightMaterial, surface } from './materials.js';
import { ROOM } from './layout.js';
import { buildWallFixtures } from './props/wallFixtures.js';
import { createPropBatch, lathe, roundBox, roundedBorder, roundedPane } from './props/geometry.js';

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

function addWindow(scene, textures, materials, lamp, detailed) {
  const group = new THREE.Group();
  group.name = 'city-window';
  group.position.set(0.44, 2.205, ROOM.back + 0.058);
  const batch = createPropBatch(group, detailed);

  batch.box(materials.housing, [4.24, 2.11, 0.167], [0, 0, 0], 0.078);
  batch.add(roundedBorder(4.15, 2.023, 0.30, 0.077, detailed), materials.housing, [0, 0, 0.191]);
  batch.add(roundedBorder(4.025, 1.935, 0.261, 0.042, detailed), materials.padding, [0, 0, 0.164]);
  batch.add(roundedBorder(3.957, 1.87, 0.227, 0.012, detailed), lamp, [0, 0, 0.153]);
  batch.add(roundedPane(3.945, 1.857, 0.223, detailed), new THREE.MeshBasicMaterial({
    map: textures.city(), fog: false, color: color('#F8EAFF').multiplyScalar(1.22),
  }), [0, 0, 0.148]);

  batch.finish();
  scene.add(group);
}

function addLightingSlots(scene, textures, materials, lamp, detailed) {
  const { halfWidth: w, height: h, back, front } = ROOM;
  const batch = createPropBatch(scene, detailed);
  const ring = new THREE.Group();
  ring.name = 'ceiling-ring';
  ring.position.set(0, h, -0.55);
  const crown = new THREE.Mesh(lathe([
    [0, -0.096], [0.9, -0.096], [0.968, -0.113], [1.057, -0.113], [1.123, -0.082],
    [1.151, -0.032], [1.153, 0.039], [0, 0.039],
  ], detailed ? 80 : 48), materials.housing);
  const torus = new THREE.Mesh(new THREE.TorusGeometry(0.976, 0.027, 8, detailed ? 96 : 56), lamp);
  torus.rotation.x = Math.PI / 2;
  torus.position.y = -0.116;
  ring.add(crown, torus);
  scene.add(ring);

  const x = w - 0.47;
  const span = front - back;
  for (const side of [-1, 1]) {
    batch.box(lamp, [0.022, 0.019, span - 0.65], [side * x, h - 0.030, (front + back + 0.35) / 2], 0.008);
    batch.box(lamp, [0.018, 0.016, span - 0.09], [side * (w - 0.033), 0.035, (front + back) / 2], 0.007);
  }
  const y = h - 0.030;
  batch.tube(lamp, [[-x, y, back + 0.50], [-x + 0.09, y, back + 0.23],
    [-x + 0.38, y, back + 0.082], [0, y, back + 0.061], [x - 0.38, y, back + 0.082],
    [x - 0.09, y, back + 0.23], [x, y, back + 0.50]], 0.012);
  batch.box(lamp, [w * 2 - 0.115, 0.015, 0.021], [0, 0.035, back + 0.055], 0.006);

  const wash = lightMaterial(LILAC, 1.1, { map: textures.wash(), transparent: true, depthWrite: false, opacity: 0.75 });
  for (const side of [-1, 1]) {
    batch.add(new THREE.PlaneGeometry(0.42, span), wash,
      [side * (w - 0.22), 0.002, (back + front) / 2], [-Math.PI / 2, 0, side === 1 ? Math.PI : 0]);
  }
  batch.add(new THREE.PlaneGeometry(0.38, w * 2), wash, [0, 0.0025, back + 0.20], [-Math.PI / 2, 0, -Math.PI / 2]);
  batch.finish();
}

function addRoomLights(scene) {
  const bounce = new THREE.HemisphereLight(color('#FFF0FF'), color('#BC9CD9'), 1.44);
  const ambient = new THREE.AmbientLight(color('#EDE3FF'), 0.84);
  const key = new THREE.DirectionalLight(color('#FFF2FF'), 1.72);
  key.position.set(-1.7, 6, 3.3);
  key.target.position.set(0, 0, -1.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -4.7, right: 4.7, top: 4.8, bottom: -4.8, near: 0.25, far: 15 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.016;
  key.shadow.radius = 4;

  const fill = new THREE.PointLight(color('#D4A6FF'), 7, 9, 2);
  fill.position.set(0.44, 2.235, ROOM.back + 0.61);
  scene.add(ambient, bounce, key, key.target, fill);
  return key;
}

export function buildGymRoom(scene, textures, materials, detailed) {
  const { halfWidth, height, back, front } = ROOM;
  scene.background = color(WALL);
  const wall = surface(WALL, {
    map: textures.panels(), side: THREE.DoubleSide, roughness: 0.46, envMapIntensity: 0.60,
  });
  const shell = new THREE.Mesh(cabinShell(detailed), wall);
  // The shell lights are inside the room, so only interior objects cast shadows.
  shell.receiveShadow = true;
  const bulkhead = new THREE.Mesh(roundBox(halfWidth * 2, height, 0.13, detailed, 0.062), wall);
  bulkhead.position.set(0, height / 2, back - 0.065);
  bulkhead.receiveShadow = true;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(halfWidth * 2, front - back), surface(DECK, {
    map: textures.floor(), roughness: 0.26, envMapIntensity: 0.52,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = (back + front) / 2;
  floor.receiveShadow = true;
  scene.add(shell, bulkhead, floor);

  const lamp = lightMaterial(LILAC, 2.65);
  addWindow(scene, textures, materials, lamp, detailed);
  addLightingSlots(scene, textures, materials, lamp, detailed);
  const { coach, menu } = buildWallFixtures(scene, { textures, materials, lamp, detailed });
  return { key: addRoomLights(scene), coach, menu };
}
