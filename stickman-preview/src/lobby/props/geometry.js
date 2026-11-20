import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function lathe(profile, segments) {
  return new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), segments);
}

export function roundBox(w, h, d, detailed, radius = Math.min(w, h, d) * 0.2) {
  return new RoundedBoxGeometry(w, h, d, detailed ? 3 : 2, radius);
}

export function chamferedShape(width, height, corner) {
  const x = width / 2, y = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-x + corner, -y);
  for (const [px, py] of [[x - corner, -y], [x, -y + corner], [x, y - corner], [x - corner, y],
    [-x + corner, y], [-x, y - corner], [-x, -y + corner]]) shape.lineTo(px, py);
  shape.closePath();
  return shape;
}

export function beveledPanel(shape, depth, bevel) {
  return new THREE.ExtrudeGeometry(shape, {
    depth, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1,
  }).translate(0, 0, -depth / 2);
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

export function roundedShape(w, h, radius) {
  const left = -w / 2, right = w / 2, top = h / 2, bottom = -h / 2;
  const r = Math.min(radius, w / 2, h / 2);
  const shape = new THREE.Shape();
  shape.moveTo(left + r, bottom);
  shape.lineTo(right - r, bottom);
  shape.quadraticCurveTo(right, bottom, right, bottom + r);
  shape.lineTo(right, top - r);
  shape.quadraticCurveTo(right, top, right - r, top);
  shape.lineTo(left + r, top);
  shape.quadraticCurveTo(left, top, left, top - r);
  shape.lineTo(left, bottom + r);
  shape.quadraticCurveTo(left, bottom, left + r, bottom);
  return shape;
}

export function roundedBorder(w, h, radius, width, detailed) {
  const segments = detailed ? 10 : 6;
  const outer = roundedShape(w, h, radius);
  const inner = roundedShape(w - width * 2, h - width * 2, radius - width);
  outer.holes.push(new THREE.Path(inner.getPoints(segments)));
  return new THREE.ShapeGeometry(outer, segments);
}

// ShapeGeometry's default UVs are world units. Fit the image to the full pane.
export function roundedPane(w, h, radius, detailed) {
  const geometry = new THREE.ShapeGeometry(roundedShape(w, h, radius), detailed ? 14 : 8);
  const { uv, position } = geometry.attributes;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, position.getX(i) / w + 0.5, position.getY(i) / h + 0.5);
  return geometry;
}
