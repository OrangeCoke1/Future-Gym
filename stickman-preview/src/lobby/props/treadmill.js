import { MeshBasicMaterial, PlaneGeometry } from 'three';
import { color, surface } from '../materials.js';
import { roundedPane } from './geometry.js';

const UP = [-Math.PI / 2, 0, 0];

export function buildTreadmill({ batch, materials, textures, signal, detailed }) {
  const { add, box, cylinder, tube } = batch;
  const { housing, graphite, aluminum, rubber } = materials;
  const belt = textures.belt();

  box(rubber, [0.96, 0.105, 1.93], [0, 0.076, 0], 0.045);
  box(graphite, [0.80, 0.104, 1.86], [0, 0.137, 0], 0.041);
  add(new PlaneGeometry(0.735, 1.68), surface('#222925', {
    map: belt, roughness: 0.84, envMapIntensity: 0.33,
  }), [0, 0.191, 0.112], UP);
  box(graphite, [0.86, 0.14, 0.27], [0, 0.177, -0.829], 0.058, [0.14, 0, 0]);

  for (const side of [-1, 1]) {
    const x = side * 0.469;
    box(housing, [0.182, 0.166, 1.99], [x, 0.154, 0], 0.079);
    box(aluminum, [0.089, 0.012, 1.38], [x, 0.239, 0.145], 0.005);
    box(rubber, [0.032, 0.006, 1.29], [x, 0.246, 0.144], 0.002);
    for (const z of [-0.486, 0.78]) {
      cylinder(graphite, 0.007, 0.006, [x + side * 0.029, 0.245, z]);
    }
    box(graphite, [0.151, 0.037, 0.014], [x, 0.155, 0.997], 0.006);
    box(signal, [0.115, 0.008, 0.010], [x, 0.155, 1.006], 0.003);
    box(rubber, [0.14, 0.041, 0.13], [x, 0.031, 0.785], 0.018);
    box(rubber, [0.14, 0.041, 0.13], [x, 0.031, -0.772], 0.018);
    tube(aluminum, [[x, 0.225, -0.762], [x, 0.43, -0.706], [x, 0.790, -0.568],
      [x * 0.984, 1.055, -0.476], [x * 0.974, 1.144, -0.446]], 0.040);
    tube(graphite, [[x, 1.106, -0.43], [x, 1.106, -0.35], [x, 1.10, -0.13]], 0.035);
    box(housing, [0.168, 0.129, 0.237], [x, 1.101, -0.285], 0.049);
    cylinder(rubber, 0.040, 0.018, [x + side * 0.09, 1.098, -0.32], [0, 0, Math.PI / 2]);
  }
  box(graphite, [0.84, 0.065, 0.14], [0, 1.103, -0.34], 0.032);
  const tilt = [-0.39, 0, 0];
  box(graphite, [0.856, 0.38, 0.071], [0, 1.277, -0.456], 0.034, tilt);
  box(aluminum, [0.792, 0.325, 0.023], [0, 1.29, -0.425], 0.011, tilt);
  add(roundedPane(0.755, 0.295, 0.036, detailed), new MeshBasicMaterial({
    map: textures.screen(), color: color('#F1F0E2').multiplyScalar(1.38),
  }), [0, 1.296, -0.407], tilt);

  return { update: dt => { belt.offset.y = (belt.offset.y + dt * 0.25) % 1; } };
}
