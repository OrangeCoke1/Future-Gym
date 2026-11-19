import * as THREE from 'three';
import { WALL_PLAQUES, WALL_PLAQUE_X, WALL_PLAQUE_Z } from '../layout.js';
import { ACCENT, GLOW, color, lightMaterial, surface } from '../materials.js';
import { lobbyRandom } from '../textures.js';
import { createCoach } from './coach.js';
import { createPropBatch, lathe, roundBox, roundedBorder, roundedPane } from './geometry.js';

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
    map: textures.fitness(), color: color('#F1F0E2').multiplyScalar(1.25),
  }), [0, 0, 0.098]);
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
  const plaqueMaterial = surface('#2F3B35', { roughness: 0.36, envMapIntensity: 0.64 });
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
  const towel = surface('#DCDAC8', { roughness: 0.9 });
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

function addPlants(scene, batch, materials, detailed) {
  const pots = [
    { x: -2.787, y: 2.778, z: 0.76, radius: 0.141, trails: 3 },
    { x: -2.805, y: 2.778, z: 0.13, radius: 0.129, trails: 2 },
    { x: -2.714, y: 1.196, z: -2.415, radius: 0.091, trails: 2 },
    { x: -2.714, y: 1.706, z: -2.545, radius: 0.071, trails: 1 },
  ];
  const geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, -0.22, 0.33, 0.018, -0.29, 0.59, 0.042, 0, 1, -0.083,
    0.26, 0.61, 0.02, 0.19, 0.34, 0.017, 0, 0.51, 0.142,
  ], 3));
  geom.setIndex([0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0, 6]);
  geom.computeVertexNormals();
  const greens = ['#527035', '#63833F', '#789646', '#435A35', '#6D843E'].map(color);
  const random = lobbyRandom(162);
  const stems = surface('#5A713B', { roughness: 0.79 });
  const leaves = new THREE.InstancedMesh(geom, surface('#FFFFFF', { side: THREE.DoubleSide, roughness: 0.69 }),
    pots.reduce((count, pot) => count + pot.trails * 14, 0));
  const transform = new THREE.Object3D();
  let index = 0;

  for (const { x, y, z, radius, trails } of pots) {
    const tall = radius * 1.1;
    batch.add(lathe([[0, 0], [radius * 0.71, 0], [radius * 0.83, tall * 0.15], [radius, tall], [radius * 0.91, tall]],
      detailed ? 24 : 14), materials.housing, [x, y, z]);
    batch.cylinder(materials.rubber, radius * 0.90, 0.016, [x, y + tall - 0.012, z]);

    for (let j = 0; j < trails; j++) {
      const angle = j * 2.4 + 0.31;
      const base = [x + Math.cos(angle) * radius * 0.38, y + tall, z + Math.sin(angle) * radius * 0.42];
      const overhang = y > 2;
      const spread = 0.22 + random() * 0.09;
      const tip = overhang ? [x + spread, y - 0.32 - random() * 0.42, z + Math.sin(angle) * 0.25]
        : [x + Math.cos(angle) * 0.15, y + 0.22 + random() * 0.09, z + Math.sin(angle) * 0.18];
      const curve = new THREE.CatmullRomCurve3([base,
        [base[0] + (overhang ? 0.08 : 0.04), base[1] + 0.13, base[2] + Math.sin(angle) * 0.108],
        [(base[0] + tip[0]) / 2 + 0.066, (base[1] + tip[1]) / 2, (base[2] + tip[2]) / 2],
        tip,
      ].map(point => new THREE.Vector3(...point)));
      batch.add(new THREE.TubeGeometry(curve, 16, 0.0045, 5), stems, [0, 0, 0]);

      for (let i = 0; i < 7; i++) {
        const t = (i + 0.6) / 7.4;
        const point = curve.getPoint(t);
        for (const side of [-1, 1]) {
          const scale = (overhang ? 0.166 : 0.127) * (1 - t * 0.48) * (0.8 + random() * 0.46);
          transform.position.copy(point);
          transform.rotation.set(0.35 + random() * 1.04, random() * 1.72 + 0.45,
            side * (0.82 + random() * 0.82) + (overhang && i > 1 ? Math.PI : 0));
          transform.scale.set(scale, scale, scale);
          transform.updateMatrix();
          leaves.setMatrixAt(index, transform.matrix);
          leaves.setColorAt(index, greens[Math.floor(random() * greens.length)]);
          index++;
        }
      }
    }
  }
  leaves.receiveShadow = true;
  scene.add(leaves);
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
  const { detailed, materials } = options;
  const batch = createPropBatch(scene, detailed);
  addStorage(batch, options);
  addPlants(scene, batch, materials, detailed);
  addPurifier(batch, options);
  const menu = addPlaques(scene, batch, options);
  batch.finish();
  return { coach: addFitnessPanel(scene, options), menu };
}
