import * as THREE from 'three';
import { color, surface } from '../materials.js';
import { extrude } from './geometry.js';

const UP = [-Math.PI / 2, 0, 0];

export function buildTreadmill({ batch, materials: { graphite, aluminum, rubber }, textures, detailed }) {
  const { add, box, cylinder, tube, foot } = batch;
  const belt = textures.belt();
  box(graphite, [0.85, 0.16, 1.95], [0, 0.12, 0], 0.04);
  add(new THREE.PlaneGeometry(0.56, 1.62), surface('#1B1E1C', {
    map: belt, roughness: 0.9, envMapIntensity: 0.34,
  }), [0, 0.201, 0.104], UP);

  const hood = new THREE.Shape();
  hood.moveTo(-0.166, 0);
  hood.lineTo(0.166, 0);
  hood.lineTo(0.144, 0.123);
  hood.quadraticCurveTo(0.123, 0.173, 0.069, 0.175);
  hood.lineTo(-0.087, 0.175);
  hood.quadraticCurveTo(-0.122, 0.172, -0.139, 0.126);
  hood.closePath();
  add(extrude(hood, 0.81, 0.02, detailed), graphite, [0, 0.164, -0.791], [0, Math.PI / 2, 0]);

  for (const sign of [-1, 1]) {
    const x = sign * 0.35;
    box(aluminum, [0.108, 0.025, 1.6], [x, 0.205, 0.085], 0.009);
    cylinder(aluminum, 0.05, 0.02, [sign * 0.422, 0.126, 0.815], [0, 0, Math.PI / 2]);
    tube(graphite, [[x, 0.17, -0.7], [x, 0.38, -0.667], [x, 0.81, -0.531], [x, 1.012, -0.446], [x, 1.15, -0.42]], 0.021);
    tube(rubber, [[x, 1.055, -0.104], [x, 1.055, -0.018], [x * 0.957, 1.052, 0.045]], 0.015);
    foot(rubber, 0.04, [x, 0, 0.761]);
    foot(rubber, 0.04, [x, 0, -0.756]);
  }
  tube(aluminum, [
    [-0.35, 1.055, -0.11], [-0.35, 1.055, -0.344], [-0.294, 1.055, -0.433],
    [-0.16, 1.055, -0.465], [0.16, 1.055, -0.465], [0.294, 1.055, -0.433],
    [0.35, 1.055, -0.344], [0.35, 1.055, -0.11],
  ], 0.0135);

  const tilt = [-Math.PI / 6, 0, 0];
  box(graphite, [0.72, 0.33, 0.05], [0, 1.249, -0.425], 0.02, tilt);
  box(aluminum, [0.604, 0.277, 0.012], [0, 1.262, -0.402], 0.005, tilt);
  add(new THREE.PlaneGeometry(0.55, 0.241), new THREE.MeshBasicMaterial({
    map: textures.screen(), color: color('#FFF4E2').multiplyScalar(1.36),
  }), [0, 1.268, -0.391], tilt);

  return { update: (_, dt) => { belt.offset.y = (belt.offset.y + dt * 0.25) % 1; } };
}
