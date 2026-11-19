import * as THREE from 'three';
import { parseGlb } from '../../render/glb.js';
import { ACCENT, GLOW, color, lightMaterial } from '../materials.js';
import { lobbyRandom } from '../textures.js';
import { lathe } from './geometry.js';

const ROLL_AXIS = [0, 0, Math.PI / 2];

function sampleCoach(positions) {
  const vertices = positions.length / 3;
  if (!Number.isInteger(vertices) || vertices < 3) return null;
  const count = Math.min(6000, vertices);
  const coordinates = new Float32Array(count * 3);
  let low = Infinity, high = -Infinity, front = -Infinity, back = Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    if (!Number.isFinite(positions[i]) || !Number.isFinite(positions[i + 1]) || !Number.isFinite(positions[i + 2])) return null;
    low = Math.min(low, positions[i + 1]);
    high = Math.max(high, positions[i + 1]);
    front = Math.max(front, positions[i + 2]);
    back = Math.min(back, positions[i + 2]);
  }
  if (high - low < 1) return null;
  const random = lobbyRandom(326);
  const scale = 1.75 / (high - low), mid = (front + back) / 2;
  for (let i = 0; i < count; i++) {
    const p = Math.floor((i + random()) * vertices / count) * 3;
    coordinates[i * 3] = positions[p] * scale;
    coordinates[i * 3 + 1] = (positions[p + 1] - low) * scale;
    coordinates[i * 3 + 2] = (positions[p + 2] - mid) * scale;
  }
  return coordinates;
}

function createCoach(group, beam) {
  let request, coach, enabled = false;
  function quality(high) {
    enabled = high;
    if (coach) coach.visible = enabled;
    beam.visible = !enabled || !coach;
    if (!high || request) return;
    request = new AbortController();
    const { signal } = request;
    fetch(import.meta.env.BASE_URL + 'male_body.glb', { signal })
      .then(response => {
        if (!response.ok) throw new Error('Coach asset unavailable');
        return response.arrayBuffer();
      })
      .then(buffer => {
        if (signal.aborted) return;
        const points = sampleCoach(parseGlb(buffer).P0);
        if (!points) return;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(points, 3));
        coach = new THREE.Points(geometry, new THREE.PointsMaterial({
          color: color(GLOW).multiplyScalar(1.08), size: 0.012, opacity: 0.73,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        coach.position.copy(beam.position);
        coach.position.y = 0.127;
        coach.visible = enabled;
        beam.visible = !coach.visible;
        group.add(coach);
      })
      .catch(() => { /* The physical projector and its beam remain visible. */ });
  }
  return {
    quality,
    update(time) {
      if (!coach?.visible) return;
      coach.rotation.y = Math.sin(time * 0.68) * 0.18;
      coach.position.y = 0.127 + Math.sin(time * 1.6) * 0.02;
    },
    dispose() { request?.abort(); },
  };
}

export function buildMatZone({ group, batch, materials, textures, detailed }) {
  const { add, box, cylinder } = batch;
  const { mat, sage, graphite, orange, rubber, roller, aluminum } = materials;
  const segments = detailed ? 40 : 24;
  box(mat, [0.61, 0.006, 1.73], [-0.225, 0.006, 0.112], 0.003);
  cylinder(sage, 0.07, 0.61, [-0.227, 0.071, 0.779], ROLL_AXIS);
  const spiral = new THREE.MeshBasicMaterial({ map: textures.roll(), transparent: true, depthWrite: false, alphaTest: 0.1 });
  add(new THREE.CircleGeometry(0.07, segments), spiral, [0.079, 0.071, 0.779], [0, Math.PI / 2, 0]);

  for (const [i, scale] of [1, 0.8].entries()) {
    const x = 0.418, z = 0.31 + i * 0.256;
    const bell = lathe([
      [0, 0], [0.051, 0], [0.064, 0.006], [0.089, 0.028], [0.100, 0.059],
      [0.100, 0.093], [0.089, 0.129], [0.066, 0.151], [0.043, 0.161], [0, 0.162],
    ].map(point => point.map(n => n * scale)), segments);
    add(bell, i ? orange : graphite, [x, 0, z]);
    add(new THREE.TorusGeometry(0.061 * scale, 0.014 * scale, 8, 32, Math.PI), rubber, [x, 0.178 * scale, z]);
    for (const sign of [-1, 1]) cylinder(rubber, 0.014 * scale, 0.053 * scale, [x + sign * 0.054 * scale, 0.161 * scale, z]);
  }
  cylinder(roller, 0.075, 0.45, [0.392, 0.079, -0.132], [Math.PI / 2, -0.28, 0]);

  const x = -0.21, z = -0.515;
  add(lathe([
    [0, 0], [0.3, 0], [0.345, 0.012], [0.35, 0.025], [0.32, 0.065], [0.288, 0.076], [0, 0.076],
  ], segments), graphite, [x, 0, z]);
  cylinder(aluminum, 0.286, 0.012, [x, 0.078, z]);
  add(new THREE.TorusGeometry(0.265, 0.004, 8, 64), lightMaterial(ACCENT, 1.8), [x, 0.084, z], [-Math.PI / 2, 0, 0]);

  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.276, 0.096, 1.74, segments, 1, true),
    lightMaterial(GLOW, 1.16, { map: textures.beam(false), transparent: true, depthWrite: false, side: THREE.BackSide }),
  );
  beam.position.set(x, 0.952, z);
  group.add(beam);
  return createCoach(group, beam);
}
