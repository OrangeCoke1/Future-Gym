import * as THREE from 'three';
import { lidAngleAt } from './timeline.js';

const RADIUS = 0.9;
const SEAM_Y = 1.5;

function shellProfile() {
  const profile = [new THREE.Vector2(RADIUS, 0.02), new THREE.Vector2(RADIUS, 0.8)];
  for (let i = 1; i <= 18; i++) {
    const a = i / 18 * Math.PI / 2;
    profile.push(new THREE.Vector2(RADIUS * Math.cos(a), 0.8 + RADIUS * Math.sin(a)));
  }
  return profile;
}

function glowMap() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(234,246,255,0.95)');
  gradient.addColorStop(0.28, 'rgba(234,246,255,0.42)');
  gradient.addColorStop(1, 'rgba(149,220,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}

export function buildCapsule(scene) {
  const pod = new THREE.Group();
  scene.add(pod);
  const shell = new THREE.LatheGeometry(shellProfile(), 64);
  const enamel = new THREE.MeshStandardMaterial({
    color: '#F1F0E2', metalness: 0.2, roughness: 0.35, side: THREE.DoubleSide,
  });
  const base = new THREE.Mesh(shell, enamel);
  base.rotation.x = Math.PI;
  pod.add(base);

  const lid = new THREE.Group();
  lid.position.z = -RADIUS;
  pod.add(lid);
  const cap = new THREE.Mesh(shell, enamel);
  cap.position.z = RADIUS;
  lid.add(cap);
  const windowFrame = new THREE.Mesh(
    new THREE.TorusGeometry(0.29, 0.036, 8, 48),
    new THREE.MeshStandardMaterial({ color: '#819695', metalness: 0.5, roughness: 0.33 }),
  );
  windowFrame.position.set(0, 0.72, 1.742);
  lid.add(windowFrame);
  const windowPane = new THREE.Mesh(
    new THREE.SphereGeometry(0.286, 32, 16),
    new THREE.MeshStandardMaterial({ color: '#152b35', emissive: '#284e60', emissiveIntensity: 0.25, roughness: 0.24 }),
  );
  windowPane.position.copy(windowFrame.position);
  windowPane.scale.z = 0.31;
  lid.add(windowPane);

  const seam = new THREE.Mesh(new THREE.TorusGeometry(0.905, 0.012, 8, 80), new THREE.ShaderMaterial({
    uniforms: { sweep: { value: 0 } },
    vertexShader: `
      varying vec2 ringUv;
      void main() {
        ringUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float sweep;
      varying vec2 ringUv;
      void main() {
        float light = smoothstep(ringUv.x, ringUv.x + 0.085, sweep * 1.09);
        gl_FragColor = vec4(mix(vec3(0.085,0.19,0.22),vec3(0.82,0.95,1.0),light),1.0);
        #include <encodings_fragment>
      }`,
  }));
  seam.rotation.set(Math.PI / 2, 0, Math.PI * 0.48);
  pod.add(seam);
  const lamp = new THREE.PointLight('#EAF6FF', 0, 5, 2);
  lamp.position.y = 0.12;
  pod.add(lamp);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap(), color: '#dcf5ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  halo.position.set(0, 0.12, 0.08);
  halo.scale.set(3.3, 3.3, 1);
  pod.add(halo);

  const positions = new Float32Array(1500 * 3), velocity = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const a = Math.random() * Math.PI * 2;
    const r = 0.3 + Math.random() * 1.3;
    velocity[i] = Math.cos(a) * r;
    velocity[i + 1] = Math.random() * 1.5 - 0.24;
    velocity[i + 2] = Math.sin(a) * r;
  }
  const geometry = new THREE.BufferGeometry();
  const points = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', points);
  const burst = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: '#c9edff', size: 0.025, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  burst.frustumCulled = false;
  pod.add(burst);

  return function animate(t, phase) {
    pod.position.y = SEAM_Y + Math.sin(t * 2.7) * 0.03;
    pod.rotation.y = -0.24 + 0.24 * phase.dolly + 0.05 * Math.sin(t * 1.6);
    seam.material.uniforms.sweep.value = phase.seam;
    lid.rotation.x = lidAngleAt(t);
    lamp.intensity = phase.lid * 10;
    halo.material.opacity = phase.lid * (0.62 + 0.38 * phase.dolly);
    burst.visible = phase.burst > 0 && phase.burst < 1;
    if (!burst.visible) return;
    burst.material.opacity = (1 - phase.burst) * Math.min(1, phase.burst * 8) * 0.85;
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] = velocity[i] * (0.3 + 1.5 * phase.burst);
      positions[i + 1] = velocity[i + 1] * phase.burst;
      positions[i + 2] = velocity[i + 2] * (0.3 + 1.5 * phase.burst);
    }
    points.needsUpdate = true;
  };
}
