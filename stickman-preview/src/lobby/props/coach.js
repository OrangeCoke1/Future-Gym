import * as THREE from 'three';
import { parseGlb } from '../../render/glb.js';
import { LILAC, color } from '../materials.js';
import { lobbyRandom } from '../textures.js';

function sampleCoach(positions) {
  const vertices = positions.length / 3;
  if (!Number.isInteger(vertices) || vertices < 3) return null;
  const count = Math.min(6000, vertices);
  const points = new Float32Array(count * 3);
  let bottom = Infinity, top = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    if (!Number.isFinite(positions[i]) || !Number.isFinite(positions[i + 1]) || !Number.isFinite(positions[i + 2])) return null;
    bottom = Math.min(bottom, positions[i + 1]);
    top = Math.max(top, positions[i + 1]);
  }
  if (top - bottom < 1) return null;
  const random = lobbyRandom(326);
  const scale = 0.91 / (top - bottom);
  for (let i = 0; i < count; i++) {
    const vertex = Math.floor((i + random()) * vertices / count) * 3;
    points[i * 3] = positions[vertex] * scale;
    points[i * 3 + 1] = (positions[vertex + 1] - bottom) * scale;
    points[i * 3 + 2] = positions[vertex + 2] * scale * 0.08;
  }
  return points;
}

export function createCoach(panel, outline) {
  let request, coach, enabled = false;
  function quality(high) {
    enabled = high;
    if (coach) coach.visible = enabled;
    outline.material.opacity = enabled && coach ? 0.28 : 0.84;
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
          color: color(LILAC).multiplyScalar(1.44), size: 0.0085, opacity: 0.62,
          transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        coach.position.set(outline.position.x, -0.466, outline.position.z + 0.021);
        coach.visible = enabled;
        outline.material.opacity = enabled ? 0.28 : 0.84;
        panel.add(coach);
      })
      .catch(() => { /* Keep the panel's illustrated contour when the model cannot load. */ });
  }
  return {
    quality,
    update(time) {
      if (coach?.visible) coach.material.opacity = 0.59 + Math.sin(time * 1.2) * 0.06;
    },
    dispose() { request?.abort(); },
  };
}
