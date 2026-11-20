import * as THREE from 'three';
import { HATCH } from './layout.js';
import { capturePhoto } from './photoCapture.js';
import { HATCH_CROSS, SPLAT_LAND } from './timeline.js';

const splatVertex = /* glsl */`
  attribute vec2 captureUv;
  uniform vec3 uLaunchCenter;
  uniform vec2 uLaunchSize;
  uniform vec2 uFlightWindow;
  uniform float uTime;
  uniform vec2 uViewport;
  uniform float uDiameter;
  uniform float uMaxSize;
  varying vec2 vPhotoUv;
  varying vec2 vDirection;
  varying float vStretch;
  varying float vAlpha;
  varying float vGlow;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 across = captureUv - 0.5;
    vec2 onPlane = across * uLaunchSize;
    float radius = length(onPlane) / length(uLaunchSize * 0.5);
    float ripple = sin(onPlane.x * 25.0 + onPlane.y * 12.0) * sin(onPlane.y * 20.0 - onPlane.x * 8.0);
    float birth = uFlightWindow.x + 0.48 * clamp(radius + 0.042 * ripple, 0.0, 1.0);
    float age = uTime - birth;
    if (age <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 1.0;
      return;
    }

    vec3 seed = vec3(hash(captureUv), hash(captureUv + 3.19), hash(captureUv + 9.72));
    vec3 scatter = seed - 0.5;
    vec3 start = uLaunchCenter + vec3(onPlane, 0.0) + scatter * vec3(0.21, 0.24, 0.54);
    vec3 goal = position;
    float foreground = smoothstep(-4.3, 3.0, goal.z);
    float launch = birth + 0.035 + mix(0.08, 0.19, foreground) * seed.x;
    float end = uFlightWindow.y - 0.43 * (1.0 - foreground) - 0.16 * seed.z;
    float t = clamp((uTime - launch) / (end - launch), 0.0, 1.0);
    float p = t * t * (3.0 - 2.0 * t);

    vec3 bend = vec3(0.32 + across.y * 1.5 + scatter.x * 1.81,
      0.35 - across.x * 1.3 + scatter.y * 1.42, 0.22 + scatter.z * 1.15);
    vec3 first = mix(start, goal, 0.22) + bend;
    vec3 second = mix(start, goal, 0.72) + vec3(-0.34 * bend.x, 0.4 + scatter.z, 0.27 * bend.z);
    vec3 a = mix(start, first, p);
    vec3 b = mix(first, second, p);
    vec3 c = mix(second, goal, p);
    vec3 left = mix(a, b, p);
    vec3 right = mix(b, c, p);
    vec4 clip = projectionMatrix * modelViewMatrix * vec4(mix(left, right, p), 1.0);
    vec4 tangent = projectionMatrix * modelViewMatrix * vec4(right - left, 0.0);
    vec2 screen = (tangent.xy * clip.w - clip.xy * tangent.w) * uViewport;
    float speed = length(screen) * (18.0 * t * (1.0 - t)) /
      max(clip.w * clip.w * uViewport.y * (end - launch), 0.001);
    float moving = clamp(1.45 * speed, 0.0, 1.0);
    float diameter = uDiameter * mix(0.58, 1.0, smoothstep(0.56, 1.0, t)) * (1.0 + 0.44 * moving);
    vStretch = 1.0 + 2.2 * moving;
    vDirection = normalize(screen + vec2(0.001, 0.0));
    vPhotoUv = captureUv;
    vAlpha = (0.98 - 0.36 * moving) * smoothstep(0.0, 0.067, age);
    vGlow = 0.36 * (1.0 - smoothstep(0.015, 0.13, age));
    gl_PointSize = clamp(diameter * vStretch, 1.0, uMaxSize);
    gl_Position = clip;
  }
`;

const splatFragment = /* glsl */`
  uniform sampler2D uPhoto;
  uniform float uOpacity;
  varying vec2 vPhotoUv;
  varying vec2 vDirection;
  varying float vStretch;
  varying float vAlpha;
  varying float vGlow;

  void main() {
    vec2 p = 2.0 * gl_PointCoord - 1.0;
    p.y = -p.y;
    vec2 ellipse = vec2(dot(p, vDirection), dot(p, vec2(-vDirection.y, vDirection.x)) * vStretch);
    float radius = dot(ellipse, ellipse);
    if (radius >= 1.0) discard;
    float gaussian = exp(-2.65 * radius) * (1.0 - smoothstep(0.74, 1.0, radius));
    vec3 rgb = mix(texture2D(uPhoto, vPhotoUv).rgb, vec3(1.0, 0.85, 0.67), vGlow);
    gl_FragColor = vec4(rgb, vAlpha * gaussian * uOpacity);
    #include <encodings_fragment>
  }
`;

export function createParticleIntro(renderer, room, home, detailed) {
  const { photo, positions, uvs } = capturePhoto(renderer, room, home, detailed);
  const count = uvs.length / 2;
  if (!count) {
    photo.dispose();
    return null;
  }

  const stage = new THREE.Scene();
  const shade = { value: 1 }, opacity = { value: 1 };
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: { uShade: shade },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      uniform float uShade;
      varying vec2 vUv;
      void main() {
        vec2 fromLight = (vUv - vec2(0.48, 0.54)) * vec2(1.4, 1.0);
        float light = exp(-5.3 * dot(fromLight, fromLight));
        gl_FragColor = vec4(mix(vec3(0.003, 0.005, 0.009), vec3(0.017, 0.023, 0.035), light), uShade);
        #include <encodings_fragment>
      }
    `,
    depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
  }));
  backdrop.frustumCulled = false;

  const splats = new THREE.BufferGeometry();
  splats.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  splats.setAttribute('captureUv', new THREE.BufferAttribute(uvs, 2));
  const time = { value: 0 }, viewport = { value: new THREE.Vector2() }, diameter = { value: 0 };
  const gl = renderer.getContext();
  const height = Math.min(2.18, 2.8 * Math.tan(THREE.MathUtils.degToRad(home.fov / 2)));
  const points = new THREE.Points(splats, new THREE.ShaderMaterial({
    uniforms: {
      uPhoto: { value: photo.texture },
      uLaunchCenter: { value: new THREE.Vector3(0, HATCH.y, HATCH.z - 2.6) },
      uLaunchSize: { value: new THREE.Vector2(height * home.aspect, height) },
      uFlightWindow: { value: new THREE.Vector2(HATCH_CROSS, SPLAT_LAND) },
      uTime: time,
      uViewport: viewport,
      uDiameter: diameter,
      uMaxSize: { value: Math.min(28, gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]) },
      uOpacity: opacity,
    },
    vertexShader: splatVertex, fragmentShader: splatFragment, depthWrite: false, transparent: true, toneMapped: false,
  }));
  points.renderOrder = 2;
  points.frustumCulled = false;
  stage.add(backdrop, points);

  return {
    render(camera, phase, elapsed, composite) {
      shade.value = phase.doorwayFade * (1 - phase.room);
      opacity.value = (1 - phase.room) ** 1.65;
      time.value = elapsed;
      renderer.getDrawingBufferSize(viewport.value);
      diameter.value = 3.02 * Math.sqrt(viewport.value.x * viewport.value.y / count);
      const autoClear = renderer.autoClear;
      if (composite) {
        renderer.autoClear = false;
        renderer.clearDepth();
      }
      try {
        renderer.render(stage, camera);
      } finally {
        renderer.autoClear = autoClear;
      }
    },
    dispose() {
      for (const object of [backdrop, points]) {
        object.geometry.dispose();
        object.material.dispose();
      }
      photo.dispose();
    },
  };
}
