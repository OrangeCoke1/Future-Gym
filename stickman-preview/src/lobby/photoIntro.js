import * as THREE from 'three';
import { capturePhoto } from './photoCapture.js';
import { PHOTO_DISSOLVED, PHOTO_SETTLE, SPLAT_FLIGHT_START, SPLAT_LAND } from './timeline.js';

const inset = new THREE.Vector2(0.043, 0.150);
const imageSize = new THREE.Vector2(0.914, 0.807);
const photoRipple = /* glsl */`
  uniform vec2 uInset;
  uniform vec2 uImageSize;
  uniform float uPhotoAspect;

  float dissolveAt(vec2 uv) {
    vec2 delta = (uv - vec2(0.58, 0.55)) * vec2(uPhotoAspect, 1.0);
    float radius = length(delta) / length(vec2(0.58 * uPhotoAspect, 0.55));
    float ripple = sin(30.0 * delta.x + 16.0 * delta.y) * sin(23.0 * delta.y - 9.0 * delta.x);
    return clamp(radius * 0.965 + ripple * 0.026 * smoothstep(0.0, 0.18, radius), 0.0, 0.97);
  }
`;

const planeVertex = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const photoFragment = /* glsl */`
  ${photoRipple}
  uniform sampler2D uPhoto;
  uniform float uDissolve;
  uniform float uGlint;
  varying vec2 vUv;

  void main() {
    float edge = dissolveAt(vUv) - uDissolve;
    if (edge < -0.026) discard;

    vec2 corner = max(abs(vUv - 0.5) - vec2(0.489, 0.483), 0.0) * vec2(uPhotoAspect, 1.0);
    float paper = 1.0 - smoothstep(0.014, 0.018, length(corner));
    if (paper <= 0.0) discard;

    vec2 imageUv = (vUv - uInset) / uImageSize;
    vec2 imageEdge = min(imageUv, 1.0 - imageUv);
    float inside = smoothstep(-0.001, 0.001, min(imageEdge.x, imageEdge.y));
    vec3 ivory = vec3(0.935, 0.909, 0.847) * (0.94 + 0.06 * vUv.y);
    vec3 rgb = mix(ivory, texture2D(uPhoto, imageUv).rgb, inside);

    float shine = vUv.x + 0.32 * vUv.y - mix(-0.22, 1.52, uGlint);
    float reflection = exp(-55.0 * shine * shine) * sin(3.14159265 * uGlint);
    rgb = mix(rgb, vec3(1.0, 0.96, 0.86), reflection * 0.51);

    float rim = (1.0 - smoothstep(0.0, 0.034, abs(edge))) * smoothstep(0.0, 0.045, uDissolve);
    rgb = mix(rgb, vec3(1.0, 0.85, 0.64), rim);
    float coverage = uDissolve == 0.0 ? 1.0 : smoothstep(0.0, 0.009, edge);
    gl_FragColor = vec4(rgb, paper * max(coverage, rim * 0.85));
    #include <encodings_fragment>
  }
`;

const splatVertex = /* glsl */`
  ${photoRipple}
  attribute vec2 captureUv;
  uniform mat4 uLaunchPlane;
  uniform vec4 uTimes;
  uniform float uTime;
  uniform vec2 uViewport;
  uniform float uDiameter;
  uniform float uMaxSize;
  varying vec2 vPhotoUv;
  varying vec2 vDirection;
  varying float vStretch;
  varying float vAlpha;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec2 printUv = uInset + captureUv * uImageSize;
    float birth = mix(uTimes.x, uTimes.y, dissolveAt(printUv));
    float age = uTime - birth;
    if (age <= 0.0) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 1.0;
      return;
    }

    vec3 seed = vec3(hash(captureUv), hash(captureUv + 3.19), hash(captureUv + 9.72));
    vec3 scatter = seed - 0.5;
    vec3 start = (uLaunchPlane * vec4(printUv - 0.5, 0.0, 1.0)).xyz;
    start += vec3(scatter.x * 0.23, scatter.y * 0.22, 0.05 + scatter.z * 0.22)
      * smoothstep(0.0, 0.32, age);
    vec3 goal = position;
    float foreground = smoothstep(-5.0, 2.6, goal.z);
    float launch = max(uTimes.z, birth) + mix(0.19, 0.36, foreground) * seed.x + 0.11 * captureUv.y;
    float end = uTimes.w - 0.56 * (1.0 - foreground) - 0.18 * seed.z;
    float t = clamp((uTime - launch) / (end - launch), 0.0, 1.0);
    float p = t * t * (3.0 - 2.0 * t);

    vec2 acrossPrint = printUv - vec2(0.5);
    vec3 bend = vec3(0.37 + 1.5 * acrossPrint.y + scatter.x * 1.8,
      0.45 - 1.3 * acrossPrint.x + scatter.y * 1.45, 0.22 + scatter.z * 1.15);
    vec3 first = mix(start, goal, 0.22) + bend;
    vec3 second = mix(start, goal, 0.72) + vec3(-0.34 * bend.x, 0.40 + scatter.z, 0.27 * bend.z);
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
    float diameter = uDiameter * mix(0.56, 1.0, smoothstep(0.63, 1.0, t)) * (1.0 + 0.40 * moving);
    vStretch = 1.0 + 2.15 * moving;
    vDirection = normalize(screen + vec2(0.001, 0.0));
    vPhotoUv = captureUv;
    vAlpha = (0.98 - 0.38 * moving) * smoothstep(0.0, 0.087, age);
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

  void main() {
    vec2 p = 2.0 * gl_PointCoord - 1.0;
    p.y = -p.y;
    vec2 ellipse = vec2(dot(p, vDirection), dot(p, vec2(-vDirection.y, vDirection.x)) * vStretch);
    float radius = dot(ellipse, ellipse);
    if (radius >= 1.0) discard;
    float gaussian = exp(-2.65 * radius) * (1.0 - smoothstep(0.74, 1.0, radius));
    gl_FragColor = vec4(texture2D(uPhoto, vPhotoUv).rgb, vAlpha * gaussian * uOpacity);
    #include <encodings_fragment>
  }
`;

export function createPhotoIntro(renderer, room, home, side, detailed) {
  const { photo, positions, uvs } = capturePhoto(renderer, room, home, detailed);
  const count = uvs.length / 2;
  if (!count) {
    photo.dispose();
    return null;
  }

  const stage = new THREE.Scene();
  const photoAspect = photo.width * imageSize.y / (photo.height * imageSize.x);
  const shared = {
    uPhoto: { value: photo.texture },
    uPhotoAspect: { value: photoAspect },
    uInset: { value: inset },
    uImageSize: { value: imageSize },
  };
  const shade = { value: 1 }, opacity = { value: 1 }, glint = { value: 0 }, dissolve = { value: 0 };
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
        vec2 fromLight = (vUv - vec2(0.46, 0.58)) * vec2(1.4, 1.0);
        float light = exp(-5.3 * dot(fromLight, fromLight));
        gl_FragColor = vec4(mix(vec3(0.0019, 0.0032, 0.0035), vec3(0.012, 0.019, 0.017), light), uShade);
        #include <encodings_fragment>
      }
    `,
    depthTest: false, depthWrite: false, transparent: true, toneMapped: false,
  }));
  backdrop.frustumCulled = false;

  const mount = new THREE.Group();
  mount.position.copy(side.position);
  mount.quaternion.copy(side.quaternion);
  const card = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { ...shared, uDissolve: dissolve, uGlint: glint },
    vertexShader: planeVertex, fragmentShader: photoFragment, transparent: true, toneMapped: false,
  }));
  card.renderOrder = 1;
  mount.add(card);
  stage.add(backdrop, mount);

  const distance = 2.5;
  const viewHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(side.fov / 2));
  const viewWidth = viewHeight * side.aspect;
  const height = viewHeight * 0.68;
  card.scale.set(height * photoAspect, height, 1);

  function pose(toss, rebound) {
    const remaining = 1 - toss;
    card.position.set(
      viewWidth * (0.83 * remaining - 0.105 * rebound),
      viewHeight * (0.022 - 0.68 * remaining + 0.15 * Math.sin(Math.PI * toss) + 0.10 * rebound),
      -distance * (1 + 0.29 * remaining + 0.08 * rebound),
    );
    card.rotation.set(0.048 - 0.57 * remaining, -0.074 - 1.03 * remaining + 0.25 * rebound,
      -0.035 - 0.69 * remaining - 0.27 * rebound);
  }

  pose(1, 0);
  mount.updateMatrixWorld(true);
  const splats = new THREE.BufferGeometry();
  splats.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  splats.setAttribute('captureUv', new THREE.BufferAttribute(uvs, 2));
  const time = { value: 0 }, viewport = { value: new THREE.Vector2() }, diameter = { value: 0 };
  const gl = renderer.getContext();
  const points = new THREE.Points(splats, new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uLaunchPlane: { value: card.matrixWorld.clone() },
      uTimes: { value: new THREE.Vector4(PHOTO_SETTLE, PHOTO_DISSOLVED, SPLAT_FLIGHT_START, SPLAT_LAND) },
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
  stage.add(points);

  return {
    render(camera, phase, elapsed) {
      shade.value = 1 - phase.room;
      opacity.value = shade.value ** 1.65;
      glint.value = phase.glint;
      dissolve.value = phase.dissolve;
      card.visible = phase.dissolve < 1;
      if (card.visible) pose(phase.toss, phase.rebound);
      points.visible = phase.dissolve > 0;
      time.value = elapsed;
      renderer.getDrawingBufferSize(viewport.value);
      diameter.value = 3.02 * Math.sqrt(viewport.value.x * viewport.value.y / count);
      const autoClear = renderer.autoClear;
      if (phase.room > 0) {
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
      for (const object of [backdrop, card, points]) {
        object.geometry.dispose();
        object.material.dispose();
      }
      photo.dispose();
    },
  };
}
