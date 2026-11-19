import * as THREE from 'three';
import { DECK, GLOW, WALL, color, lightMaterial, surface } from './materials.js';
import { roundBox } from './props/geometry.js';

const RADIUS = 4.4;
const AXIS_HEIGHT = 1.5;
const STRAIGHT = 14;
const WINDOW_Y = 3.39;
const WINDOW_Z = -9.18;

function hullGeometry(detailed) {
  const hull = new THREE.CapsuleGeometry(RADIUS, STRAIGHT, detailed ? 32 : 16, detailed ? 96 : 64);
  const { uv, position } = hull.attributes;
  for (let i = 0; i < uv.count; i++) uv.setY(i, 0.5 + position.getY(i) / (STRAIGHT + 2 * RADIUS));
  return hull;
}

function innerWallZ(x, y) {
  return -STRAIGHT / 2 - Math.sqrt(RADIUS ** 2 - x ** 2 - (y - AXIS_HEIGHT) ** 2);
}

function windowCollar(detailed) {
  const sides = detailed ? 96 : 48;
  const profile = [
    [1.37, () => WINDOW_Z - 0.31],
    [1.389, () => WINDOW_Z - 0.045],
    [1.46, () => WINDOW_Z - 0.043],
    [1.55, (x, y) => THREE.MathUtils.lerp(WINDOW_Z, innerWallZ(x, y), 0.52)],
    [1.73, (x, y) => innerWallZ(x, y) + 0.015],
  ];
  const xyz = [], triangles = [];
  for (const [row, [radius, depth]] of profile.entries()) {
    for (let i = 0; i < sides; i++) {
      const angle = i * Math.PI * 2 / sides;
      const x = radius * Math.cos(angle), y = WINDOW_Y + radius * Math.sin(angle);
      xyz.push(x, y, depth(x, y));
      if (!row) continue;
      const below = (row - 1) * sides;
      const here = row * sides;
      const next = (i + 1) % sides;
      triangles.push(below + i, here + i, here + next, below + i, here + next, below + next);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  return geometry;
}

function addWindow(scene, textures, materials, detailed) {
  const segments = detailed ? 96 : 48;
  scene.add(new THREE.Mesh(windowCollar(detailed), surface('#DDD9CE', {
    side: THREE.DoubleSide, roughness: 0.55, envMapIntensity: 0.54,
  })));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.06, detailed ? 24 : 12, segments), materials.aluminum);
  rim.position.set(0, WINDOW_Y, WINDOW_Z);
  const gasket = new THREE.Mesh(new THREE.TorusGeometry(1.352, 0.017, 8, segments), materials.graphite);
  gasket.position.set(0, WINDOW_Y, WINDOW_Z - 0.032);
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(1.38, segments),
    new THREE.MeshBasicMaterial({ map: textures.space(), fog: false }),
  );
  glass.position.set(0, WINDOW_Y, WINDOW_Z - 0.3);
  scene.add(rim, gasket, glass);

  const lettering = new THREE.PlaneGeometry(2.25, 0.28, 18, 1);
  const position = lettering.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i) + 1.68;
    position.setXYZ(i, x, y, innerWallZ(x, y) + 0.019);
  }
  scene.add(new THREE.Mesh(lettering, new THREE.MeshBasicMaterial({
    map: textures.wallMark(), transparent: true, depthWrite: false, alphaTest: 0.08,
  })));
}

function addLightingSlots(scene, textures, detailed) {
  const channel = surface('#BDB8AA', { roughness: 0.62, envMapIntensity: 0.55 });
  const light = lightMaterial();
  const wash = lightMaterial(GLOW, 1, { map: textures.wash(), transparent: true, depthWrite: false, opacity: 0.48 });

  for (const side of [-1, 1]) {
    const x = side * 0.9;
    const y = AXIS_HEIGHT + Math.sqrt(RADIUS ** 2 - x ** 2) - 0.025;
    const angle = -Math.asin(x / RADIUS);
    const addStrip = (geometry, material, sx, sy, rz) => {
      const strip = new THREE.Mesh(geometry, material);
      strip.position.set(sx, sy, 0);
      strip.rotation.z = rz;
      scene.add(strip);
    };
    addStrip(roundBox(0.144, 0.033, 13.54, detailed, 0.008), channel, x, y + 0.003, angle);
    addStrip(roundBox(0.06, 0.02, 13.5, detailed, 0.006), light, x, y - 0.016, angle);

    const end = new THREE.CatmullRomCurve3(Array.from({ length: 5 }, (_, i) => {
      const z = -6.74 - i * 0.59;
      const innerY = AXIS_HEIGHT + Math.sqrt(RADIUS ** 2 - x ** 2 - (z + STRAIGHT / 2) ** 2) - 0.048;
      return new THREE.Vector3(x, innerY, z);
    }));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(end, detailed ? 32 : 16, 0.026, 8), light));

    addStrip(roundBox(0.039, 0.058, 13.6, detailed, 0.01), channel, side * 4.11, 0.052, 0);
    addStrip(roundBox(0.015, 0.023, 13.5, detailed, 0.005), light, side * 4.086, 0.057, 0);
    const lightWash = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 13.55), wash);
    lightWash.rotation.set(-Math.PI / 2, 0, side === 1 ? Math.PI : 0);
    lightWash.position.set(side * 3.802, 0.003, 0);
    scene.add(lightWash);
  }
}

function addRoomLights(scene) {
  const ambient = new THREE.HemisphereLight(color('#FFF8EE'), color(DECK), 0.6);
  // Approximate the broad indirect light bouncing off the pale interior.
  const bounce = new THREE.AmbientLight(color('#FFF6E8'), 1.56);
  const key = new THREE.DirectionalLight(color(GLOW), 2.2);
  key.position.set(1.5, 6, 3);
  key.target.position.set(0, 0, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 0.25, far: 16 });
  key.shadow.camera.updateProjectionMatrix();
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  key.shadow.radius = 4;

  const fill = new THREE.PointLight(color('#C9D8FF'), 4, 8, 2);
  fill.position.set(0, WINDOW_Y - 0.42, WINDOW_Z + 0.78);
  scene.add(ambient, bounce, key, key.target, fill);
  return key;
}

export function buildGymRoom(scene, textures, materials, detailed) {
  scene.background = new THREE.Color(WALL);
  scene.fog = new THREE.Fog(color('#E9E5DA'), 14, 30);
  const hull = new THREE.Mesh(hullGeometry(detailed), surface(WALL, {
    map: textures.panels(), side: THREE.BackSide, roughness: 0.55, envMapIntensity: 0.86,
  }));
  hull.rotation.x = Math.PI / 2;
  hull.position.y = AXIS_HEIGHT;

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 22), surface(DECK, {
    map: textures.floor(), roughness: 0.28, envMapIntensity: 0.48,
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(hull, floor);
  addLightingSlots(scene, textures, detailed);
  addWindow(scene, textures, materials, detailed);
  return addRoomLights(scene);
}
