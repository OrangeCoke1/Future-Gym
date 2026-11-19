import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function lathe(profile, segments) {
  return new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), segments);
}

export function roundBox(w, h, d, detailed, radius = Math.min(w, h, d) * 0.2) {
  return new RoundedBoxGeometry(w, h, d, detailed ? 3 : 2, radius);
}

export function extrude(shape, depth, bevel, detailed) {
  return new THREE.ExtrudeGeometry(shape, {
    depth, bevelThickness: bevel, bevelSize: bevel, bevelSegments: detailed ? 3 : 1, curveSegments: detailed ? 8 : 4,
  }).translate(0, 0, -depth / 2);
}

export function footGeometry(radius, detailed) {
  return lathe([
    [0, 0], [radius * 0.84, 0], [radius * 0.99, 0.004], [radius, 0.009],
    [radius * 0.88, 0.026], [radius * 0.77, 0.03], [0, 0.03],
  ], detailed ? 32 : 16);
}

export function createPropBatch(group, detailed) {
  const groups = new Map();
  const transform = new THREE.Object3D();
  const segments = detailed ? 32 : 16;

  function add(geometry, material, [x, y, z], [rx, ry, rz] = [0, 0, 0]) {
    transform.position.set(x, y, z);
    transform.rotation.set(rx, ry, rz);
    transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    if (geometry.index) {
      const indexed = geometry;
      geometry = indexed.toNonIndexed();
      indexed.dispose();
    }
    if (!groups.has(material)) groups.set(material, []);
    groups.get(material).push(geometry);
  }

  return {
    add,
    box(material, dimensions, position, radius, rotation) {
      add(roundBox(...dimensions, detailed, radius), material, position, rotation);
    },
    cylinder(material, radius, length, position, rotation) {
      add(new THREE.CylinderGeometry(radius, radius, length, segments), material, position, rotation);
    },
    tube(material, path, radius) {
      const curve = new THREE.CatmullRomCurve3(path.map(point => new THREE.Vector3(...point)));
      add(new THREE.TubeGeometry(curve, detailed ? 48 : 24, radius, detailed ? 16 : 8), material, [0, 0, 0]);
    },
    foot(material, radius, position) {
      add(footGeometry(radius, detailed), material, position);
    },
    finish() {
      for (const [material, parts] of groups) {
        const geometry = parts.length === 1 ? parts[0] : mergeBufferGeometries(parts);
        if (parts.length > 1) for (const part of parts) part.dispose();
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = material.isMeshStandardMaterial && !material.transparent;
        mesh.receiveShadow = mesh.castShadow;
        mesh.matrixAutoUpdate = false;
        group.add(mesh);
      }
      groups.clear();
    },
  };
}
