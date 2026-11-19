import * as THREE from 'three';
import { stationPosition, stationYaw } from './camRig.js';
import { GLOW, WALL, color, lightMaterial, surface } from './materials.js';
import { buildDumbbells } from './props/dumbbells.js';
import { createPropBatch, roundBox } from './props/geometry.js';
import { buildMatZone } from './props/matZone.js';
import { buildSquatRack } from './props/squatRack.js';
import { buildTreadmill } from './props/treadmill.js';
import { lobbyRandom } from './textures.js';

const SPOT_INTENSITY = 18;
const PANEL_HEIGHT = 2.6;
const PANEL_DEPTH = -1.11;
const WARM = color(GLOW);
const DESIGN = {
  cardio: { caption: 'TREADMILL', width: 1.64, panel: 1.48, props: buildTreadmill },
  squat: { caption: 'SQUAT RACK', width: 2.17, panel: 1.6, props: buildSquatRack },
  dumbbell: { caption: 'DUMBBELL RACK', width: 1.88, panel: 1.6, props: buildDumbbells },
  mat: { caption: 'MAT ZONE', width: 1.66, panel: 1.48, props: buildMatZone },
};

export function createBayMaterials(textures) {
  return {
    platform: surface('#3A3D38', { roughness: 0.6, bumpMap: textures.grain(), bumpScale: 0.0018, envMapIntensity: 0.45 }),
    board: surface(WALL, { roughness: 0.55, side: THREE.DoubleSide, envMapIntensity: 0.57 }),
    verticalLight: lightMaterial(),
    shadow: new THREE.MeshBasicMaterial({ map: textures.shadow(), transparent: true, depthWrite: false }),
    beam: lightMaterial(GLOW, 1, {
      map: textures.beam(true), transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
    }),
    dust: new THREE.PointsMaterial({
      color: color(GLOW), size: 0.012, opacity: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    }),
  };
}

function makeBoard(width, detailed) {
  const radius = 3;
  const halfAngle = Math.asin(width / (radius * 2));
  const geometry = new THREE.CylinderGeometry(
    radius, radius, PANEL_HEIGHT, detailed ? 32 : 16, 1, true, Math.PI - halfAngle, halfAngle * 2,
  );
  geometry.translate(0, PANEL_HEIGHT / 2, radius + PANEL_DEPTH);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
  return geometry;
}

function addSpot(group) {
  const spot = new THREE.SpotLight(color('#FFF1DC'), SPOT_INTENSITY, 5, 0.42, 0.8, 2);
  spot.position.set(0, 3.4, 0.23);
  spot.target.position.set(0, 0, -0.07);
  group.add(spot, spot.target);
  return spot;
}

function addSpotVolume(group, spot, materials, seed) {
  const direction = spot.position.clone().sub(spot.target.position).normalize();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(1.51, 3.36, 28, 1, true), materials.beam);
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  cone.position.copy(spot.target.position).addScaledVector(direction, 1.7);
  group.add(cone);

  const geometry = new THREE.BufferGeometry();
  const xyz = new Float32Array(50 * 3);
  const random = lobbyRandom(seed);
  const particles = Array.from({ length: 50 }, () => ({
    height: random(), angle: random() * Math.PI * 2, radius: Math.sqrt(random()) * 0.86, speed: 0.023 + random() * 0.02,
  }));
  const positions = new THREE.BufferAttribute(xyz, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', positions);
  const dust = new THREE.Points(geometry, materials.dust);
  dust.frustumCulled = false;
  group.add(dust);
  return (visible, time) => {
    cone.visible = dust.visible = visible;
    if (!visible) return;
    for (const [i, particle] of particles.entries()) {
      const height = (particle.height + time * particle.speed) % 1;
      const radius = (1 - height) * particle.radius * 1.5;
      positions.setXYZ(i, Math.cos(particle.angle) * radius, height * 3.26 + 0.08,
        Math.sin(particle.angle) * radius + 0.3 * height - 0.07);
    }
    positions.needsUpdate = true;
  };
}

/** Builds one static bay and keeps hover/light motion separate from its pick volume. */
export function buildStation(station, { detailed, materials, bayMaterials, textures, accent }) {
  const design = DESIGN[station.id];
  const group = new THREE.Group();
  group.position.copy(stationPosition(station.angle));
  group.rotation.y = stationYaw(group.position.x);

  const platform = new THREE.Mesh(roundBox(design.width, 0.051, 2.08, detailed, 0.018), bayMaterials.platform);
  platform.position.y = 0.036;
  platform.receiveShadow = true;
  const seam = new THREE.Mesh(roundBox(design.width - 0.017, 0.011, 2.06, detailed, 0.004), lightMaterial(GLOW, 1.2));
  seam.position.y = 0.01;
  group.add(platform, seam);

  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), bayMaterials.shadow);
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.set(0, 0.002, 0.11);
  group.add(groundShadow);

  const board = makeBoard(design.panel, detailed);
  group.add(new THREE.Mesh(board, bayMaterials.board));
  const engraving = new THREE.Mesh(board, new THREE.MeshBasicMaterial({
    map: textures.engraving(station.name, design.caption), side: THREE.BackSide, transparent: true, depthWrite: false, alphaTest: 0.08,
  }));
  engraving.position.z = 0.0028;
  group.add(engraving);
  const strip = new THREE.Mesh(roundBox(0.04, 2.2, 0.022, detailed, 0.008), bayMaterials.verticalLight);
  strip.position.set(0, 1.19, PANEL_DEPTH + 0.013);
  group.add(strip);

  const equipment = new THREE.Group();
  equipment.position.y = 0.0615;
  const batch = createPropBatch(equipment, detailed);
  const props = design.props({ group: equipment, batch, materials, textures, detailed });
  batch.finish();
  group.add(equipment);

  const spot = addSpot(group);
  const volume = addSpotVolume(group, spot, bayMaterials, 2126 + station.angle);
  const anchor = new THREE.Object3D();
  anchor.position.set(0, PANEL_HEIGHT + 0.13, PANEL_DEPTH + 0.09);
  group.add(anchor);

  const collider = new THREE.Mesh(new THREE.BoxGeometry(design.width - 0.025, PANEL_HEIGHT, 2.02), materials.rubber);
  collider.position.set(0, PANEL_HEIGHT / 2, -0.11);
  collider.visible = false;
  collider.userData.station = station.id;
  group.add(collider);

  let level = 0;
  return {
    group, collider, anchor,
    quality(high) { props?.quality?.(high); },
    update(dt, time, reveal, hovered, focus, high, reduced) {
      const goal = Number(hovered), before = level;
      level = reduced ? goal : level + THREE.MathUtils.clamp(goal - level, -dt / 0.25, dt / 0.25);
      const eased = level * level * (3 - 2 * level);
      equipment.position.y = 0.0615 + eased * 0.04;
      seam.material.color.copy(WARM).lerp(accent, eased).multiplyScalar(1.2 + eased * 2.1);
      spot.intensity = SPOT_INTENSITY * reveal * (1 + eased * 0.4 + focus);
      volume(high && (reveal > 0.5), reduced ? 0 : time);
      if (!reduced) props?.update?.(time, dt);
      return level !== before;
    },
    dispose() { props?.dispose?.(); },
  };
}
