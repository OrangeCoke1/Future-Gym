import * as THREE from 'three';
import { extrude, lathe } from './geometry.js';

const CROSSWISE = [0, 0, Math.PI / 2];

function barbellPlate(radius, detailed) {
  return lathe([
    [0.025, -0.023], [0.059, -0.023], [0.066, -0.018], [radius - 0.016, -0.018],
    [radius - 0.012, -0.027], [radius - 0.006, -0.03], [radius, -0.024],
    [radius, 0.024], [radius - 0.006, 0.03], [radius - 0.012, 0.027],
    [radius - 0.016, 0.018], [0.066, 0.018], [0.059, 0.023], [0.025, 0.023],
  ], detailed ? 48 : 24);
}

export function buildSquatRack({ batch, materials: { graphite, aluminum, chrome, grip, rubber, orange }, textures, detailed }) {
  const { add, box, cylinder } = batch;
  const holes = new THREE.MeshBasicMaterial({
    map: textures.holes(), transparent: true, alphaTest: 0.12, depthWrite: false,
  });
  const hook = new THREE.Shape();
  hook.moveTo(-0.056, -0.026);
  hook.lineTo(0.043, -0.026);
  hook.quadraticCurveTo(0.068, -0.025, 0.068, 0.002);
  hook.lineTo(0.068, 0.042);
  hook.lineTo(0.045, 0.042);
  hook.lineTo(0.042, 0.005);
  hook.lineTo(-0.03, 0.005);
  hook.lineTo(-0.03, 0.048);
  hook.lineTo(-0.056, 0.048);
  hook.closePath();

  for (const sign of [-1, 1]) {
    const x = sign * 0.6;
    for (const z of [-0.5, 0.3]) {
      box(graphite, [0.075, 2.3, 0.075], [x, 1.16, z], 0.008);
      box(rubber, [0.12, 0.02, 0.12], [x, 0.012, z], 0.004);
    }
    add(new THREE.PlaneGeometry(0.067, 2.15), holes, [x, 1.17, 0.339]);
    add(new THREE.PlaneGeometry(0.067, 2.15), holes, [x - sign * 0.039, 1.17, 0.3], [0, -sign * Math.PI / 2, 0]);
    box(graphite, [0.075, 0.075, 0.875], [x, 2.275, -0.1], 0.009);
    box(graphite, [0.05, 0.05, 0.866], [x, 0.65, -0.092], 0.009);
    add(extrude(hook, 0.066, 0.004, detailed), aluminum, [x, 1.348, 0.394], [0, -Math.PI / 2, 0]);
    box(orange, [0.06, 0.01, 0.07], [x, 1.359, 0.399], 0.002);
    cylinder(chrome, 0.025, 0.42, [sign * 0.88, 1.382, 0.406], CROSSWISE);
    cylinder(chrome, 0.033, 0.03, [sign * 0.667, 1.382, 0.406], CROSSWISE);
    add(barbellPlate(0.225, detailed), rubber, [sign * 0.752, 1.382, 0.406], CROSSWISE);
    add(barbellPlate(0.16, detailed), orange, [sign * 0.832, 1.382, 0.406], CROSSWISE);
    cylinder(aluminum, 0.061, 0.018, [sign * 0.871, 1.382, 0.406], CROSSWISE);
  }

  for (const z of [0.3, -0.5]) {
    box(graphite, [1.275, 0.075, 0.075], [0, 2.275, z], 0.009);
    box(graphite, [1.275, 0.075, 0.075], [0, 0.063, z], 0.009);
  }
  cylinder(chrome, 0.016, 1.3, [0, 2.206, 0.382], CROSSWISE);
  cylinder(grip, 0.014, 1.31, [0, 1.382, 0.406], CROSSWISE);
}
