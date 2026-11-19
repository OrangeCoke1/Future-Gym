import * as THREE from 'three';
import { ACCENT, GLOW, INK, color, lightMaterial, surface } from './materials.js';
import { extrude, lathe, roundBox } from './props/geometry.js';
import { lobbyRandom } from './textures.js';

const RADIUS = 0.9;
const HALF_SPAN = 0.9;
const PORT_RADIUS = 0.55;
const TAIL_RADIUS = 0.397;
const PORT_Z = HALF_SPAN + Math.sqrt(RADIUS ** 2 - PORT_RADIUS ** 2);
const TAIL_Z = -HALF_SPAN - Math.sqrt(RADIUS ** 2 - TAIL_RADIUS ** 2);

function hullProfile(detailed) {
  const arc = [];
  const sections = detailed ? 24 : 16;
  for (const sign of [-1, 1]) {
    const rim = Math.acos((sign === -1 ? TAIL_RADIUS : PORT_RADIUS) / RADIUS);
    for (let i = 0; i <= sections; i++) {
      const theta = rim * (sign === -1 ? (i / sections - 1) : i / sections);
      arc.push([RADIUS * Math.cos(theta), sign * HALF_SPAN + RADIUS * Math.sin(theta)]);
    }
  }
  arc.push([PORT_RADIUS - 0.011, PORT_Z - 0.011]);
  return arc;
}

function doorShape(side) {
  const shape = new THREE.Shape();
  const segments = 32;
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments - 0.5) * Math.PI;
    const x = side * (0.006 + 0.531 * Math.cos(a)), y = 0.531 * Math.sin(a);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function pressureDust(pod) {
  const geometry = new THREE.BufferGeometry();
  const count = 180;
  const xyz = new THREE.BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', xyz);
  const dust = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: color('#FFF2D8'), size: 0.014, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  dust.frustumCulled = false;
  pod.add(dust);
  const random = lobbyRandom(1976);
  const seeds = Array.from({ length: count }, () => ({
    theta: random() * Math.PI * 2, radius: Math.sqrt(random()) * 0.43,
    speed: 0.15 + random() * 0.39, offset: random() * 0.13,
  }));
  return burst => {
    dust.visible = burst > 0 && burst < 1;
    if (!dust.visible) return;
    dust.material.opacity = 0.45 * Math.min(1, burst * 12) * (1 - burst) ** 2;
    for (const [i, seed] of seeds.entries()) {
      const r = seed.radius * (0.9 + burst * 0.43);
      xyz.setXYZ(i, Math.cos(seed.theta) * r, Math.sin(seed.theta) * r + burst * 0.115,
        PORT_Z - 0.02 + seed.offset + seed.speed * burst);
    }
    xyz.needsUpdate = true;
  };
}

export function buildCapsule(scene, textures, detailed) {
  const pod = new THREE.Group();
  scene.add(pod);
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(40, detailed ? 48 : 32, 28),
    new THREE.MeshBasicMaterial({ map: textures.space(true), side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);

  const moon = new THREE.DirectionalLight(color('#D6E2FF'), 1.5);
  moon.position.set(-3, 5, 3);
  const bounce = new THREE.DirectionalLight(color('#FFDDBB'), 0.3);
  bounce.position.set(4, -2, 2);
  scene.add(moon, bounce);

  const enamel = new THREE.MeshPhysicalMaterial({
    color: color('#F4F2EA'), roughness: 0.22, metalness: 0, clearcoat: 1,
    clearcoatRoughness: 0.08, envMapIntensity: 0.52,
  });
  const skin = enamel.clone();
  skin.map = textures.hull();
  const shell = lathe(hullProfile(detailed), detailed ? 96 : 64);
  const { uv, position } = shell.attributes;
  for (let i = 0; i < uv.count; i++) uv.setY(i, (position.getY(i) - TAIL_Z) / (PORT_Z - TAIL_Z));
  shell.rotateX(Math.PI / 2);
  pod.add(new THREE.Mesh(shell, skin));

  const ringMetal = surface('#C9CCC8', { roughness: 0.3, metalness: 1, envMapIntensity: 0.72 });
  const darkSide = surface(INK, { roughness: 0.48, side: THREE.BackSide });
  for (let i = 0; i < 4; i++) {
    const segment = new THREE.Mesh(
      new THREE.TorusGeometry(0.905, 0.018, 10, detailed ? 32 : 16, Math.PI / 2 - 0.06), ringMetal,
    );
    segment.rotation.z = (i + 0.43) * Math.PI / 2;
    segment.position.z = -0.29;
    pod.add(segment);
  }

  const nozzle = lathe([
    [TAIL_RADIUS, TAIL_Z + 0.027], [TAIL_RADIUS, TAIL_Z - 0.003], [0.356, TAIL_Z - 0.017],
    [0.329, TAIL_Z + 0.027], [0.211, TAIL_Z + 0.157], [0.18, TAIL_Z + 0.21],
  ], detailed ? 64 : 32).rotateX(Math.PI / 2);
  const nozzleMaterial = surface(INK, { roughness: 0.43, metalness: 0.52, side: THREE.DoubleSide });
  pod.add(new THREE.Mesh(nozzle, nozzleMaterial));
  const exhaust = new THREE.Mesh(new THREE.CircleGeometry(0.19, 32), lightMaterial('#DC9E68', 0.29, { side: THREE.BackSide }));
  exhaust.position.z = TAIL_Z + 0.217;
  pod.add(exhaust);

  const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.559, 0.019, 12, 72), ringMetal);
  bezel.position.z = PORT_Z;
  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.554, 0.008, 8, 72), lightMaterial(GLOW, 0.28));
  seam.position.z = PORT_Z + 0.019;
  const opening = new THREE.Mesh(
    new THREE.CircleGeometry(0.538, 64), lightMaterial('#FFF6E8', 0.22, { map: textures.door(), side: THREE.DoubleSide }),
  );
  opening.position.z = PORT_Z - 0.026;
  pod.add(bezel, seam, opening);

  const doors = [-1, 1].map(side => {
    const shape = doorShape(side);
    const group = new THREE.Group();
    const leaf = new THREE.Mesh(extrude(shape, 0.031, 0.006, detailed), [enamel, ringMetal]);
    const inner = new THREE.Mesh(new THREE.ShapeGeometry(shape), darkSide);
    inner.position.z = -0.022;
    group.add(leaf, inner);
    pod.add(group);
    return { side, group };
  });

  const indicator = new THREE.Mesh(roundBox(0.014, 0.049, 0.085, detailed, 0.006), lightMaterial(ACCENT, 1));
  indicator.position.set(0.891, 0.116, 0.37);
  pod.add(indicator);
  const spill = new THREE.PointLight(color(GLOW), 0, 3.3, 2);
  spill.position.z = PORT_Z + 0.075;
  pod.add(spill);
  const updateDust = pressureDust(pod);
  const warm = color(GLOW), glow = color('#FFF8EE'), orange = color(ACCENT);

  return {
    pod,
    update(time, phase) {
      pod.position.y = 1.32 + Math.sin(time * Math.PI / 2) * 0.03;
      pod.rotation.y = time * 0.05;
      seam.material.color.copy(warm).multiplyScalar(0.23 + phase.seam * 2.25);
      opening.material.color.copy(glow).multiplyScalar(0.18 + phase.lid * 2.44 + phase.dolly * 1.24);
      spill.intensity = phase.lid * 2.7;
      for (const { side, group } of doors) {
        group.position.set(side * 0.63 * phase.lid, 0, PORT_Z + 0.023 + phase.pop * 0.03);
      }
      const blink = time > 0.8 && time < 1.4 ? Math.sin((time - 0.8) * Math.PI / 0.3) ** 2 : 0;
      indicator.material.color.copy(orange).multiplyScalar(0.88 + Math.sin(time * 2.2) * 0.21 + blink * 2.45);
      updateDust(phase.burst);
    },
  };
}
