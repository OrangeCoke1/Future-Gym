import * as THREE from 'three';
import { BAYS } from './layout.js';
import { LILAC, VIOLET, color, lightMaterial } from './materials.js';
import { buildDumbbells } from './props/dumbbells.js';
import { createPropBatch } from './props/geometry.js';
import { buildMatZone } from './props/matZone.js';
import { buildSquatRack } from './props/squatRack.js';
import { buildTreadmill } from './props/treadmill.js';

const lilac = color(LILAC), violet = color(VIOLET);
const builders = { cardio: buildTreadmill, squat: buildSquatRack, dumbbell: buildDumbbells, mat: buildMatZone };

export function buildStation(station, { detailed, materials, shadow, textures }) {
  const bay = BAYS[station.id];
  const [w, h, d] = bay.size;
  const group = new THREE.Group();
  group.name = station.id;
  group.position.set(...bay.position);
  group.rotation.y = bay.yaw;
  group.scale.setScalar(bay.scale ?? 1);

  const batch = createPropBatch(group, detailed);
  const signal = lightMaterial(LILAC, 1.6);
  const props = builders[station.id]({ batch, materials, textures, signal, detailed });
  batch.finish();

  const groundShadow = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.30, d + 0.28), shadow);
  groundShadow.rotation.x = -Math.PI / 2;
  groundShadow.position.y = 0.0015;
  const anchor = new THREE.Object3D();
  anchor.position.set(...bay.anchor);
  const collider = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), materials.rubber);
  collider.position.y = h / 2;
  collider.visible = false;
  collider.userData.station = station.id;
  group.add(groundShadow, collider, anchor);

  let level = 0;
  return {
    group, collider, anchor,
    update(dt, reveal, hovered, focus, reduced) {
      const goal = Number(hovered);
      level = reduced ? goal : level + THREE.MathUtils.clamp(goal - level, -dt / 0.25, dt / 0.25);
      const eased = level * level * (3 - 2 * level);
      signal.color.copy(lilac).lerp(violet, eased).multiplyScalar(0.55 + reveal + eased * 2.7 + focus);
      if (!reduced) props?.update(dt);
    },
  };
}
