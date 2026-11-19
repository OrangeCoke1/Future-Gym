import * as THREE from 'three';
import { extrude } from './geometry.js';

const LENGTHWISE = [Math.PI / 2, 0, 0];
const TRAY_TILT = -Math.PI / 15;

function hexHead(radius, detailed) {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const theta = (i + 0.5) * Math.PI / 3;
    const x = radius * Math.cos(theta), y = radius * Math.sin(theta);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return extrude(shape, 0.048, 0.004, detailed);
}

function weightLabel(radius, slot) {
  const geometry = new THREE.PlaneGeometry(radius * 1.04, radius * 0.92);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) + slot) / 5, 0.4 + uv.getY(i) * 0.2);
  return geometry;
}

export function buildDumbbells({ batch, materials: { graphite, aluminum, grip, rubber }, textures, detailed }) {
  const { add, box, cylinder, foot } = batch;
  const digits = new THREE.MeshBasicMaterial({
    map: textures.weights(), transparent: true, alphaTest: 0.14, depthWrite: false,
  });
  const bracket = new THREE.Shape();
  bracket.moveTo(-0.305, 0.024);
  bracket.lineTo(0.295, 0.024);
  bracket.lineTo(0.141, 0.824);
  bracket.quadraticCurveTo(0.138, 0.844, 0.114, 0.845);
  bracket.lineTo(-0.195, 0.845);
  bracket.quadraticCurveTo(-0.217, 0.839, -0.222, 0.812);
  bracket.closePath();

  for (const sign of [-1, 1]) {
    add(extrude(bracket, 0.05, 0.008, detailed), graphite, [sign * 0.8, 0, 0], [0, Math.PI / 2, 0]);
    foot(rubber, 0.038, [sign * 0.8, 0, -0.241]);
    foot(rubber, 0.038, [sign * 0.8, 0, 0.235]);
  }

  for (const [row, { y, z, quantities }] of [
    { y: 0.777, z: -0.085, quantities: [0, 1] },
    { y: 0.478, z: 0.139, quantities: [2, 3, 4] },
  ].entries()) {
    box(aluminum, [1.55, 0.03, 0.32], [0, y, z], 0.009, [TRAY_TILT, 0, 0]);
    box(rubber, [1.55, 0.04, 0.015], [0, y + 0.065, z + 0.152], 0.006, [TRAY_TILT, 0, 0]);
    const spacing = row === 0 ? 0.33 : 0.24;
    for (const [pair, slot] of quantities.entries()) {
      const radius = 0.055 + slot * 0.0075;
      const head = hexHead(radius, detailed);
      for (const offset of [0, 1]) {
        const x = (pair * 2 + offset - (quantities.length * 2 - 1) / 2) * spacing;
        const h = y + radius + 0.014;
        cylinder(grip, 0.017, 0.13, [x, h, z], LENGTHWISE);
        for (const sign of [-1, 1]) {
          const angle = sign === 1 ? 0 : Math.PI;
          const end = z + sign * 0.09;
          add(head.clone(), rubber, [x, h - sign * 0.012, end], [TRAY_TILT, 0, 0]);
          cylinder(aluminum, radius * 0.6, 0.009, [x, h - sign * 0.016, end + sign * 0.027], LENGTHWISE);
          add(weightLabel(radius, slot), digits, [x, h - sign * 0.016, end + sign * 0.032], [0, angle, 0]);
        }
      }
      head.dispose();
    }
  }
}
