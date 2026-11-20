import * as THREE from 'three';
import { HATCH } from './layout.js';
import { ACCENT, NAVY, WALL, color, lightMaterial, surface } from './materials.js';
import { beveledPanel, lathe } from './props/geometry.js';

const RADIUS = 0.9;
const HALF_SPAN = 0.9;
const TAIL_RADIUS = 0.397;
const PORT_Z = HALF_SPAN + Math.sqrt(RADIUS ** 2 - HATCH.radius ** 2);
const TAIL_Z = -HALF_SPAN - Math.sqrt(RADIUS ** 2 - TAIL_RADIUS ** 2);

function hullProfile(detailed) {
  const profile = [];
  const sections = detailed ? 24 : 16;
  for (const sign of [-1, 1]) {
    const rim = Math.acos((sign === -1 ? TAIL_RADIUS : HATCH.radius) / RADIUS);
    for (let i = 0; i <= sections; i++) {
      const theta = rim * (sign === -1 ? i / sections - 1 : i / sections);
      profile.push([RADIUS * Math.cos(theta), sign * HALF_SPAN + RADIUS * Math.sin(theta)]);
    }
  }
  profile.push([HATCH.radius - 0.011, PORT_Z - 0.011]);
  return profile;
}

function doorShape(side) {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 32; i++) {
    const angle = (i / 32 - 0.5) * Math.PI;
    const x = side * (0.006 + 0.531 * Math.cos(angle)), y = 0.531 * Math.sin(angle);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

export function buildCapsule(textures, detailed, environment) {
  const scene = new THREE.Scene();
  scene.background = color('#141D2B');
  scene.fog = new THREE.Fog(scene.background, 8.4, 19);
  scene.environment = environment;
  const pod = new THREE.Group();
  pod.position.set(0, HATCH.y, HATCH.z - PORT_Z);
  scene.add(pod);

  const enamel = surface('#E5EBF5', { roughness: 0.28, metalness: 0.13 });
  const panel = surface(WALL, { roughness: 0.39, metalness: 0.18 });
  const rail = surface(NAVY, { roughness: 0.37, metalness: 0.56 });
  const steel = surface('#ACBAD0', { roughness: 0.29, metalness: 0.76 });
  const bumper = surface(ACCENT, { roughness: 0.36, metalness: 0.18 });
  const warm = color('#FFE5BF');
  const lamp = lightMaterial('#FFE5BF', 0.75);

  function mount(group, geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  const shell = lathe(hullProfile(detailed), detailed ? 96 : 64);
  const { uv, position } = shell.attributes;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (position.getY(i) - TAIL_Z) / (PORT_Z - TAIL_Z));
  mount(pod, shell.rotateX(Math.PI / 2), surface('#E5EBF5', {
    map: textures.capsuleSkin(), roughness: 0.28, metalness: 0.15, envMapIntensity: 0.76,
  }), 0, 0, 0);

  const segments = detailed ? 60 : 36;
  mount(pod, new THREE.TorusGeometry(0.562, 0.039, 12, segments), rail, 0, 0, PORT_Z - 0.012);
  mount(pod, new THREE.TorusGeometry(0.525, 0.014, 8, segments), lamp, 0, 0, PORT_Z + 0.020);
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2 + Math.PI / 5;
    const protect = mount(pod, new THREE.TorusGeometry(0.582, 0.049, 8, 18, 0.41), bumper, 0, 0, PORT_Z - 0.042);
    protect.rotation.z = angle;
    const rib = mount(pod, new THREE.TorusGeometry(0.904, 0.018, 8, 20, Math.PI / 2 - 0.092), rail, 0, 0, -0.40);
    rib.rotation.z = angle;
    const latch = mount(pod, new THREE.TorusGeometry(0.908, 0.047, 8, 18, 0.38), bumper, 0, 0, 0.64);
    latch.rotation.z = angle;
  }

  const nozzle = lathe([
    [TAIL_RADIUS, TAIL_Z + 0.027], [TAIL_RADIUS, TAIL_Z - 0.017], [0.327, TAIL_Z + 0.016],
    [0.257, TAIL_Z + 0.137], [0.17, TAIL_Z + 0.195],
  ], segments).rotateX(Math.PI / 2);
  mount(pod, nozzle, rail, 0, 0, 0);

  const liner = new THREE.CylinderGeometry(0.516, 0.518, 1.43, segments, 1, true).rotateX(Math.PI / 2);
  mount(pod, liner, surface('#263449', { side: THREE.BackSide, roughness: 0.58, metalness: 0.18 }),
    0, 0, PORT_Z - 0.74);
  mount(pod, new THREE.TorusGeometry(0.505, 0.009, 6, segments), lamp, 0, 0, PORT_Z - 0.60);
  mount(pod, new THREE.TorusGeometry(0.501, 0.006, 6, segments), steel, 0, 0, PORT_Z - 1.03);
  mount(pod, new THREE.CircleGeometry(0.52, segments), lightMaterial('#283344', 0.38), 0, 0, PORT_Z - 1.46);

  const doors = [-1, 1].map(side => {
    const group = new THREE.Group();
    pod.add(group);
    const shape = doorShape(side);
    mount(group, beveledPanel(shape, 0.042, 0.008), enamel, 0, 0, 0);
    const inset = mount(group, beveledPanel(shape, 0.010, 0.004), panel, side * 0.037, 0, 0.027);
    inset.scale.set(0.84, 0.86, 1);
    const pull = mount(group, new THREE.CapsuleGeometry(0.013, 0.119, 3, 8), rail, side * 0.104, 0.024, 0.042);
    pull.rotation.z = side * -0.065;
    return { group, side };
  });

  const ground = mount(scene, new THREE.PlaneGeometry(140, 140),
    surface('#243145', { roughness: 0.86 }), 0, 0, HATCH.z - 3);
  ground.rotation.x = -Math.PI / 2;
  const shadow = mount(scene, new THREE.PlaneGeometry(4.1, 4.9), new THREE.MeshBasicMaterial({
    map: textures.shadow(), transparent: true, depthWrite: false,
  }), 0, 0.005, HATCH.z - 1.9);
  shadow.rotation.x = -Math.PI / 2;
  const key = new THREE.DirectionalLight(color('#F4F7FF'), 3.05);
  key.position.set(-3, 7, HATCH.z + 5);
  const edge = new THREE.DirectionalLight(color('#B9CFFF'), 1.21);
  edge.position.set(5, 2.9, HATCH.z - 1);
  scene.add(key, edge, new THREE.HemisphereLight(color('#E6EFFF'), color('#667288'), 0.96));

  return {
    scene,
    update(phase) {
      for (const { group, side } of doors) {
        group.position.set(side * 0.64 * phase.doors, 0, PORT_Z + 0.028 + 0.088 * phase.unlock);
      }
      lamp.color.copy(warm).multiplyScalar(0.22 + 0.79 * phase.unlock + 0.57 * phase.doors);
    },
  };
}
