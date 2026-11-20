import * as THREE from 'three';
import { WALL_PLAQUES, WALL_PLAQUE_X, WALL_PLAQUE_Z } from '../layout.js';
import { ACCENT, GLOW, color, lightMaterial, surface } from '../materials.js';
import { createCoach } from './coach.js';
import { beveledPanel, chamferedShape, createPropBatch, lathe, roundBox, roundedBorder, roundedPane } from './geometry.js';

function addFitnessPanel(scene, { textures, materials, detailed }) {
  const panel = new THREE.Group();
  panel.name = 'fitness-panel';
  panel.position.set(-2.75, 1.967, -0.305);
  panel.rotation.y = 1.43;
  const batch = createPropBatch(panel, detailed);
  batch.box(materials.housing, [2.77, 1.36, 0.57], [0, 0, -0.20], 0.078);
  batch.add(roundedPane(2.71, 1.311, 0.181, detailed), materials.graphite, [0, 0, 0.090]);
  batch.add(roundedBorder(2.668, 1.271, 0.157, 0.012, detailed), materials.aluminum, [0, 0, 0.097]);
  batch.add(roundedPane(2.649, 1.254, 0.147, detailed), new THREE.MeshBasicMaterial({
    map: textures.fitness(), color: color('#EAF2FF').multiplyScalar(1.25),
  }), [0, 0, 0.098]);
  const guard = surface(ACCENT, { roughness: 0.36, metalness: 0.18 });
  for (const side of [-1, 1]) {
    for (const vertical of [-1, 1]) {
      batch.add(beveledPanel(chamferedShape(0.20, 0.105, 0.028), 0.042, 0.012),
        guard, [side * 1.287, vertical * 0.587, 0.105], [0, 0, -side * vertical * Math.PI / 4]);
    }
  }
  batch.finish();

  const outline = new THREE.Mesh(new THREE.PlaneGeometry(1.105, 1.052), lightMaterial(GLOW, 1.46, {
    map: textures.coachOutline(), transparent: true, opacity: 0.84, depthWrite: false,
  }));
  outline.position.set(-0.603, -0.015, 0.103);
  panel.add(outline);
  scene.add(panel);
  return createCoach(panel, outline);
}

function addPlaques(scene, batch, { textures, materials, detailed }) {
  const plaqueMaterial = surface('#27354B', { roughness: 0.36, envMapIntensity: 0.64 });
  const ivory = color(GLOW), terracotta = color(ACCENT);
  const shell = roundBox(0.667, 0.438, 0.085, detailed, 0.040);
  const faceGeometry = roundedPane(0.632, 0.403, 0.111, detailed);
  const iconGeometry = new THREE.PlaneGeometry(0.375, 0.292);
  const indicatorGeometry = roundBox(0.053, 0.008, 0.005, detailed, 0.002);
  const indicatorLight = lightMaterial(ACCENT, 2.15);
  const colliders = [], controls = new Map();
  for (const { id, y } of WALL_PLAQUES) {
    const plaque = new THREE.Group();
    plaque.name = `plaque-${id}`;
    plaque.position.set(WALL_PLAQUE_X, y, WALL_PLAQUE_Z);
    plaque.rotation.y = -Math.PI / 2;
    const housing = new THREE.Mesh(shell, materials.housing);
    housing.userData.station = id;
    colliders.push(housing);

    const face = new THREE.Mesh(faceGeometry, plaqueMaterial);
    face.position.z = 0.046;
    batch.add(roundedBorder(0.603, 0.371, 0.096, 0.007, detailed), materials.aluminum,
      [WALL_PLAQUE_X - 0.049, y, WALL_PLAQUE_Z], [0, -Math.PI / 2, 0]);
    const icon = new THREE.Mesh(iconGeometry, lightMaterial(GLOW, 1.82, {
      map: textures.icon(id), transparent: true, alphaTest: 0.07, depthWrite: false,
    }));
    icon.position.z = 0.05;
    const indicator = new THREE.Mesh(indicatorGeometry, indicatorLight);
    indicator.position.set(0, -0.141, 0.051);
    indicator.visible = false;
    controls.set(id, { icon, indicator });
    plaque.add(housing, face, icon, indicator);
    scene.add(plaque);
  }
  return {
    colliders,
    highlight(active) {
      for (const [id, { icon, indicator }] of controls) {
        const selected = id === active;
        icon.material.color.copy(selected ? terracotta : ivory).multiplyScalar(selected ? 3.8 : 1.82);
        indicator.visible = selected;
      }
    },
  };
}

function addStorage(batch, { materials, lamp, detailed }) {
  const { housing, padding } = materials;
  const towel = surface('#D7E0EF', { roughness: 0.9 });
  batch.box(housing, [0.93, 0.72, 0.18], [1.302, 0.40, -4.284], 0.074);
  batch.add(roundedPane(0.86, 0.665, 0.13, detailed), padding, [1.302, 0.40, -4.19]);
  batch.box(housing, [0.88, 0.046, 0.25], [1.302, 0.381, -4.085], 0.021);
  batch.box(housing, [0.90, 0.061, 0.26], [1.302, 0.089, -4.084], 0.028);
  batch.add(roundedBorder(0.935, 0.727, 0.123, 0.062, detailed), housing, [1.302, 0.40, -3.953]);
  batch.add(roundedBorder(0.891, 0.684, 0.108, 0.011, detailed), lamp, [1.302, 0.40, -3.942]);
  for (const y of [0.153, 0.224, 0.437, 0.507]) {
    for (const x of [1.172, 1.423]) {
      batch.box(towel, [0.244, 0.072, 0.145], [x, y, -4.029], 0.034, [0, (y % 0.04) - 0.023, 0]);
    }
  }

  const yaw = [0, Math.PI / 2, 0];
  const shelfZ = -2.48;
  batch.box(housing, [1.07, 2.98, 0.265], [-2.9, 1.57, shelfZ], 0.102, yaw);
  batch.add(roundedPane(0.778, 1.57, 0.161, detailed), padding, [-2.759, 1.906, shelfZ], yaw);
  batch.add(roundedBorder(0.847, 1.651, 0.178, 0.025, detailed), lamp, [-2.743, 1.906, shelfZ], yaw);
  for (const y of [1.158, 1.67, 2.18]) {
    batch.box(housing, [0.318, 0.069, 0.839], [-2.719, y, shelfZ], 0.026);
  }
  batch.box(housing, [0.151, 0.86, 0.81], [-2.71, 0.548, shelfZ], 0.065);
  batch.box(materials.aluminum, [0.022, 0.017, 0.078], [-2.627, 0.86, shelfZ], 0.007);
  batch.box(housing, [2.78, 0.106, 0.49], [-2.83, 2.727, -0.305], 0.051, [0, 1.43, 0]);
  batch.box(housing, [0.14, 3.32, 0.147], [-2.979, 1.675, 1.805], 0.063);
  batch.box(materials.aluminum, [0.048, 3.25, 0.032], [-2.908, 1.675, 1.756], 0.014);
  for (const y of [0.725, 1.476]) {
    batch.box(materials.aluminum, [0.062, 0.097, 0.093], [-2.913, y, 1.815], 0.023);
  }
  batch.tube(materials.graphite, [[-2.902, 0.72, 1.815], [-2.833, 0.73, 1.816],
    [-2.795, 0.805, 1.816], [-2.795, 1.401, 1.816], [-2.835, 1.475, 1.816],
    [-2.902, 1.48, 1.815]], 0.032);
}

function addPurifier(batch, { textures, materials, lamp, detailed }) {
  const center = [2.687, 0.002, 1.438];
  const segments = detailed ? 40 : 24;
  batch.add(lathe([[0, 0], [0.189, 0], [0.23, 0.018], [0.245, 0.063], [0.246, 0.67],
    [0.239, 0.759], [0.222, 0.789], [0.187, 0.805], [0, 0.805]], segments), materials.housing, center);
  const [x, y, z] = center;
  batch.add(new THREE.CylinderGeometry(0.249, 0.249, 0.533, segments, 1, true, -0.93, 1.86),
    new THREE.MeshBasicMaterial({ map: textures.grille(), transparent: true, alphaTest: 0.12, depthWrite: false }),
    [x, y + 0.407, z], [0, -0.36, 0]);
  batch.cylinder(materials.graphite, 0.113, 0.010, [x, y + 0.806, z]);
  batch.add(new THREE.TorusGeometry(0.111, 0.004, 6, segments), materials.aluminum,
    [x, y + 0.815, z], [Math.PI / 2, 0, 0]);
  batch.cylinder(materials.padding, 0.081, 0.012, [x, y + 0.808, z]);
  batch.add(new THREE.TorusGeometry(0.241, 0.010, 8, segments), lamp, [x, y + 0.057, z], [Math.PI / 2, 0, 0]);
}

export function buildWallFixtures(scene, options) {
  const { detailed } = options;
  const batch = createPropBatch(scene, detailed);
  addStorage(batch, options);
  addPurifier(batch, options);
  const menu = addPlaques(scene, batch, options);
  batch.finish();
  return { coach: addFitnessPanel(scene, options), menu };
}
