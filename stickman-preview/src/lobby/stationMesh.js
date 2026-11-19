import * as THREE from 'three';
import { color } from './gymRoom.js';
import { stationPosition } from './camRig.js';

export function buildStation(station) {
  const group = new THREE.Group();
  group.position.copy(stationPosition(station.angle));
  group.rotation.y = -THREE.MathUtils.degToRad(station.angle) * 0.25;

  const frame = new THREE.MeshStandardMaterial({ color: color('#afbdad'), metalness: 0.38, roughness: 0.42 });
  const rubber = new THREE.MeshStandardMaterial({ color: color('#24323a'), roughness: 0.88 });
  const signal = new THREE.MeshBasicMaterial({ color: color('#9ce4ed') });
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.07, 48),
    new THREE.MeshBasicMaterial({ color: color('#10181c'), transparent: true, opacity: 0.55, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  group.add(shadow);

  function part(geo, material, x, y, z) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  const box = new THREE.BoxGeometry(1, 1, 1);
  function block(x, y, z, w, h, d, material = frame) {
    const mesh = part(box, material, x, y, z);
    mesh.scale.set(w, h, d);
    return mesh;
  }

  part(new THREE.CylinderGeometry(0.89, 0.95, 0.15, 48), rubber, 0, 0.085, 0);
  const ring = part(new THREE.TorusGeometry(0.893, 0.024, 6, 48), signal, 0, 0.162, 0);
  ring.rotation.x = -Math.PI / 2;
  const beacon = part(new THREE.TorusGeometry(0.918, 0.031, 6, 48), new THREE.MeshBasicMaterial({
    color: color('#9ce4ed'), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false,
  }), 0, 0.156, 0);
  beacon.rotation.x = -Math.PI / 2;

  let labelHeight = 1.75;
  if (station.id === 'cardio') {
    block(0, 0.27, 0.07, 0.64, 0.14, 1.35);
    block(0, 0.35, 0.07, 0.46, 0.045, 1.14, rubber).rotation.x = -0.055;
    for (const side of [-1, 1]) {
      block(side * 0.31, 0.76, -0.43, 0.067, 0.91, 0.08).rotation.x = -0.17;
      block(side * 0.31, 1.11, -0.21, 0.09, 0.068, 0.43, rubber);
    }
    block(0, 1.24, -0.52, 0.65, 0.12, 0.31, frame).rotation.x = -0.3;
    block(0, 1.29, -0.48, 0.44, 0.022, 0.15, signal).rotation.x = -0.3;
  } else if (station.id === 'squat') {
    labelHeight = 2.02;
    const plate = new THREE.CylinderGeometry(0.19, 0.19, 0.105, 24);
    for (const side of [-1, 1]) {
      block(side * 0.51, 0.22, 0, 0.19, 0.09, 1.05, rubber);
      block(side * 0.51, 0.99, -0.14, 0.095, 1.58, 0.095);
      block(side * 0.51, 1.26, 0.005, 0.13, 0.1, 0.26, rubber);
      block(side * 0.51, 0.98, -0.085, 0.033, 0.75, 0.018, signal);
      part(plate, rubber, side * 0.64, 1.34, 0.095).rotation.z = Math.PI / 2;
    }
    block(0, 1.75, -0.14, 1.1, 0.095, 0.095);
    part(new THREE.CylinderGeometry(0.027, 0.027, 1.52, 12), frame, 0, 1.34, 0.095).rotation.z = Math.PI / 2;
  } else if (station.id === 'dumbbell') {
    labelHeight = 1.48;
    const handle = new THREE.CylinderGeometry(0.026, 0.026, 0.25, 10);
    const weight = new THREE.CylinderGeometry(0.106, 0.106, 0.077, 6);
    for (const side of [-1, 1]) block(side * 0.51, 0.58, 0, 0.1, 0.82, 0.85, frame).rotation.x = -0.36;
    for (let row = 0; row < 3; row++) {
      const y = 0.37 + row * 0.28, z = 0.34 - row * 0.32;
      block(0, y, z, 1.11, 0.077, 0.3, rubber);
      block(0, y + 0.018, z + 0.153, 0.99, 0.025, 0.021, signal);
      for (const x of [-0.25, 0.25]) {
        part(handle, frame, x, y + 0.147, z).rotation.z = Math.PI / 2;
        for (const side of [-1, 1]) part(weight, frame, x + side * 0.132, y + 0.147, z).rotation.z = Math.PI / 2;
      }
    }
  } else {
    labelHeight = 1.72;
    block(0, 0.20, 0, 0.77, 0.07, 1.4);
    block(0, 0.243, 0, 0.69, 0.03, 1.32, rubber);
    for (const side of [-1, 1]) block(side * 0.302, 0.262, 0, 0.019, 0.012, 1.19, signal);
    const lattice = new THREE.MeshBasicMaterial({ color: color('#7bd3e4'), wireframe: true, transparent: true, opacity: 0.75 });
    part(new THREE.IcosahedronGeometry(0.13, 1), lattice, 0, 1.43, 0);
    part(new THREE.CapsuleGeometry(0.13, 0.31, 4, 10), lattice, 0, 1.04, 0);
    for (const side of [-1, 1]) {
      part(new THREE.CapsuleGeometry(0.047, 0.45, 3, 8), lattice, side * 0.259, 1.115, 0).rotation.z = -side * 1.06;
      part(new THREE.CapsuleGeometry(0.056, 0.48, 3, 8), lattice, side * 0.15, 0.565, 0).rotation.z = side * 0.34;
    }
  }

  const collider = part(new THREE.CylinderGeometry(0.92, 0.96, labelHeight, 16), rubber, 0, labelHeight / 2, 0);
  collider.visible = false;
  collider.userData.station = station.id;
  const anchor = new THREE.Object3D();
  anchor.position.set(0, labelHeight, 0);
  group.add(anchor);
  return { group, collider, anchor, ring: ring.material, beacon: beacon.material };
}
