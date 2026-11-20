import * as THREE from 'three';
import { ROOM } from './layout.js';
import { color } from './materials.js';
import { chamferedShape, createPropBatch } from './props/geometry.js';
import { lobbyRandom } from './textures.js';

export const CITY_FAR = 250;

const waterLevel = -0.26;
const vertexShader = /* glsl */`
  varying vec3 vWorld;
  varying vec3 vFacing;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vFacing = mat3(modelMatrix) * normal;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const atmosphere = /* glsl */`
  varying vec3 vWorld;
  const vec3 horizon = vec3(0.40, 0.55, 0.68);
  const vec3 sun = vec3(-0.54, 0.72, 0.43);
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }
  vec3 airlight(vec3 rgb) {
    vec3 ray = cameraPosition - vWorld;
    return mix(horizon, rgb, exp(-0.000039 * dot(ray, ray)));
  }
`;

function cityMaterial(hex, glazing = 0, baysPerMeter = 2.9) {
  return new THREE.ShaderMaterial({
    uniforms: { uSurface: { value: color(hex) }, uGlazing: { value: glazing }, uBaysPerMeter: { value: baysPerMeter } },
    vertexShader,
    fragmentShader: /* glsl */`
      ${atmosphere}
      varying vec3 vFacing;
      uniform vec3 uSurface;
      uniform float uGlazing;
      uniform float uBaysPerMeter;
      void main() {
        vec3 facing = normalize(vFacing);
        vec3 toEye = normalize(cameraPosition - vWorld);
        float sunlit = max(dot(facing, sun), 0.0);
        vec3 solid = uSurface * (0.49 + sunlit * 0.77 + abs(facing.y) * 0.19);

        vec2 across = vec2(facing.z, -facing.x);
        float column = dot(vWorld.xz, across) / max(length(across), 0.001);
        vec2 grid = vec2(column * uBaysPerMeter, vWorld.y * 3.16);
        vec2 cell = fract(grid);
        float edge = clamp(distance(vWorld, cameraPosition) * 0.00068, 0.013, 0.13);
        vec2 frame = min(cell, 1.0 - cell);
        float pane = smoothstep(0.061 - edge, 0.061 + edge, frame.x)
          * smoothstep(0.115 - edge, 0.115 + edge, frame.y);
        pane *= uGlazing * (1.0 - smoothstep(0.25, 0.55, abs(facing.y)));
        float variation = hash(floor(grid) + floor(vWorld.xz * 0.32));
        float grazing = 1.0 - abs(dot(facing, toEye));
        float reflection = grazing * grazing;
        vec3 ray = reflect(-toEye, facing);
        float reflectedSky = smoothstep(-0.31, 0.22, ray.y);
        vec3 skyTint = mix(vec3(0.048, 0.091, 0.14), vec3(0.19, 0.34, 0.54), reflectedSky);
        vec3 glass = mix(uSurface * 0.27, skyTint, 0.44 + 0.41 * reflection);
        float blinds = step(0.70, variation) * smoothstep(0.32, 0.79, cell.y);
        glass *= 0.64 + 0.47 * variation + 0.28 * blinds;
        gl_FragColor = vec4(airlight(mix(solid, glass, pane)), 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }
    `,
  });
}

function addSkyAndWater(city) {
  const sky = new THREE.Mesh(new THREE.SphereGeometry(CITY_FAR - 15, 28, 16), new THREE.ShaderMaterial({
    vertexShader, side: THREE.BackSide, depthWrite: false,
    fragmentShader: /* glsl */`
      ${atmosphere}
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
      }
      void main() {
        vec3 ray = normalize(vWorld - cameraPosition);
        vec3 blue = mix(horizon, vec3(0.14, 0.31, 0.57), smoothstep(-0.01, 0.25, ray.y));
        vec2 p = ray.xz / max(ray.y + 0.24, 0.14) * vec2(1.9, 3.15);
        float vapor = 0.60 * noise(p) + 0.26 * noise(p * 2.2 + 8.7) + 0.14 * noise(p * 4.7);
        float clouds = smoothstep(0.41, 0.70, vapor) * smoothstep(0.02, 0.16, ray.y);
        vec3 sky = mix(blue, vec3(0.72, 0.79, 0.87), clouds * 0.84);
        gl_FragColor = vec4(sky, 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }
    `,
  }));
  sky.name = 'daylight sky';
  sky.renderOrder = 5;
  const riverLength = 163;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(225, riverLength).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: /* glsl */`
      ${atmosphere}
      void main() {
        vec3 eye = normalize(cameraPosition - vWorld);
        float waves = sin(vWorld.z * 19.3 + sin(vWorld.x * 2.5 + vWorld.z * 6.2) * 1.46)
          * sin(vWorld.z * 12.7 - vWorld.x * 6.3);
        float ripple = waves * exp(-0.028 * distance(vWorld, cameraPosition));
        float reflection = pow(clamp(1.0 - eye.y + 0.05 * ripple, 0.0, 1.0), 6.0);
        vec3 water = mix(vec3(0.026, 0.074, 0.13), vec3(0.15, 0.28, 0.39), reflection);
        gl_FragColor = vec4(airlight(water + ripple * 0.042), 1.0);
        #include <tonemapping_fragment>
        #include <encodings_fragment>
      }
    `,
  }));
  water.name = 'river';
  water.position.set(0, waterLevel, ROOM.back - 0.45 - riverLength / 2);
  city.add(sky, water);
}

function mass(batch, material, [x, y, z], [width, height, depth], taper = 0, lean = 0) {
  const footprint = chamferedShape(width, depth, Math.min(width, depth) * 0.14);
  const geometry = new THREE.ExtrudeGeometry(footprint, {
    depth: height, bevelEnabled: false, steps: taper ? 3 : 1,
  }).rotateX(-Math.PI / 2);
  if (taper) {
    const { position } = geometry.attributes;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      const level = y / height;
      const scale = 1 - taper * level;
      position.setXYZ(i, position.getX(i) * scale + lean * level, y, position.getZ(i) * scale);
    }
    geometry.computeVertexNormals();
  }
  batch.add(geometry, material, [x, y, z]);
}

function box(batch, material, size, center) {
  batch.add(new THREE.BoxGeometry(...size), material, center);
}

function addTerraces(city, detailed, { ceramic, glass, concrete, planting, steel }) {
  const terraces = new THREE.Group();
  terraces.name = 'near terraces';
  const batch = createPropBatch(terraces, detailed);
  for (const [x, z, width, depth, floors] of [[-4.76, -14.6, 3.45, 5.35, 4],
    [-5.95, -20.7, 4.15, 4.9, 6], [5.95, -16.6, 3.50, 4.73, 3]]) {
    mass(batch, concrete, [x, waterLevel - 0.22, z], [width + 0.52, 0.53, depth + 0.64]);
    for (let floor = 0; floor < floors; floor++) {
      const level = floor * 0.64;
      const setBack = floor / floors;
      const w = width - setBack * 0.72, d = depth - setBack * 0.47;
      mass(batch, glass, [x, level, z], [w - 0.23, 0.53, d - 0.25]);
      mass(batch, ceramic, [x, level + 0.51, z], [w, 0.13, d]);
    }
    const roof = floors * 0.64;
    const edge = x + Math.sign(-x) * (width / 2 - 0.36);
    box(batch, steel, [0.05, 0.17, depth - 0.73], [edge, roof + 0.08, z]);
    box(batch, glass, [width * 0.32, 0.28, depth * 0.45], [x, roof + 0.14, z - 0.52]);
    for (const shift of [-0.91, 0.36, 1.24]) {
      mass(batch, ceramic, [edge - Math.sign(-x) * 0.21, roof, z + shift], [0.28, 0.09, 0.32]);
      batch.add(new THREE.IcosahedronGeometry(0.19, 1).scale(0.86, 1.12, 0.80),
        planting, [edge - Math.sign(-x) * 0.21, roof + 0.24, z + shift]);
      batch.add(new THREE.IcosahedronGeometry(0.13, 1).scale(0.84, 0.87, 1.17),
        planting, [edge - Math.sign(-x) * 0.15, roof + 0.17, z + shift + 0.093]);
    }
  }
  batch.finish();
  city.add(terraces);
}

function addTransit(city, detailed, { ceramic, concrete, glass, steel, accent }) {
  const track = new THREE.Group();
  track.name = 'elevated transit';
  track.position.set(0.9, 0.79, -26.8);
  track.rotation.y = -0.39;
  const batch = createPropBatch(track, detailed);
  box(batch, concrete, [37, 0.21, 0.91], [0, 0, 0]);
  for (const side of [-1, 1]) {
    box(batch, ceramic, [37, 0.076, 0.087], [0, 0.14, side * 0.426]);
    box(batch, steel, [37, 0.042, 0.036], [0, 0.136, side * 0.235]);
  }
  const pierBottom = waterLevel - track.position.y - 0.16;
  for (let x = -16.1; x <= 17; x += 4.4) {
    box(batch, ceramic, [0.42, -0.10 - pierBottom, 0.39], [x, (pierBottom - 0.10) / 2, 0]);
    box(batch, concrete, [0.81, 0.135, 0.89], [x, -0.158, 0]);
  }
  for (const x of [0.8, 2.87, 4.94]) {
    batch.box(ceramic, [1.97, 0.39, 0.54], [x, 0.339, 0], 0.098);
    for (const side of [-1, 1]) {
      batch.box(glass, [1.66, 0.122, 0.036], [x, 0.40, side * 0.273], 0.017);
      box(batch, accent, [1.61, 0.019, 0.016], [x, 0.263, side * 0.284]);
      for (const end of [-0.50, 0, 0.50]) box(batch, steel, [0.018, 0.118, 0.012], [x + end, 0.40, side * 0.296]);
    }
  }
  batch.finish();
  city.add(track);
}

function addWaterfront(city, detailed, { ceramic, office, glass, concrete, steel, accent }) {
  const waterfront = new THREE.Group();
  waterfront.name = 'waterfront towers';
  const batch = createPropBatch(waterfront, detailed);
  box(batch, concrete, [137, 0.45, 148], [0, -0.106, -116.4]);
  box(batch, ceramic, [126, 0.14, 2.9], [0, 0.078, -42.6]);

  for (const [x, y, z, w, h, d, lean] of [[0.55, 0.17, -57.2, 2.79, 8.26, 2.68, 0.51],
    [6.87, 0.17, -59.15, 3.28, 9.64, 2.91, -0.68], [-8.20, 0.15, -60.5, 3.52, 6.42, 3.1, 0.29]]) {
    mass(batch, ceramic, [x, y, z], [w + 0.66, 1.16, d + 0.53], 0.08);
    mass(batch, glass, [x, y + 0.29, z], [w, h, d], 0.21, lean);
    for (const level of [0.08, 0.43, 0.74, 0.98]) {
      mass(batch, ceramic, [x + lean * level, y + h * level + 0.29, z],
        [w * (1 - level * 0.20) + 0.13, 0.10, d * (1 - level * 0.20) + 0.13]);
    }
    mass(batch, ceramic, [x + lean, y + h + 0.29, z], [w * 0.62, 0.30, d * 0.60], 0.30, lean * 0.18);
    mass(batch, steel, [x + lean + w * 0.17, y + h + 0.47, z - 0.31], [0.10, 0.58, 0.13], 0.25);
    for (const side of [-1, 1]) {
      mass(batch, ceramic, [x + side * w * 0.424, y + 0.61, z + d * 0.47],
        [0.14, h * 0.87, 0.18], 0.1, lean * 0.84 - side * w * 0.086);
    }
  }
  for (const [y, z, height] of [[3.9, -58.08, 0.39], [6.35, -58.18, 0.54]]) {
    mass(batch, glass, [3.7, y, z], [6.3, height, 1.04]);
    box(batch, ceramic, [6.35, 0.085, 1.12], [3.75, y + height, z]);
    box(batch, steel, [6.2, 0.081, 1.07], [3.75, y, z]);
    box(batch, accent, [0.54, 0.13, 0.14], [5.26, y + 0.11, z + 0.55]);
  }
  for (const [x, z, w, h, d] of [[-8.3, -46.3, 6.4, 1.47, 3.02], [-0.8, -49.3, 4.7, 1.73, 3.2],
    [6.75, -46.7, 5.6, 1.61, 2.7], [12.5, -48.9, 4.1, 2.31, 3.3], [-13.7, -48.1, 3.9, 2.6, 3.6]]) {
    mass(batch, office, [x, 0.17, z], [w, h, d], 0.07);
    mass(batch, ceramic, [x, h + 0.17, z], [w * 0.96, 0.14, d * 0.97]);
    mass(batch, ceramic, [x, h + 0.31, z - 0.41], [w * 0.59, 0.31, d * 0.44]);
  }
  batch.finish();
  city.add(waterfront);
}

function addSkyline(city, detailed, { ceramic, office, glass }) {
  const skyline = new THREE.Group();
  skyline.name = 'distant skyline';
  const batch = createPropBatch(skyline, detailed);
  const random = lobbyRandom(1197);
  for (const [row, z] of [-72, -96, -129, -173].entries()) {
    const span = 22 + row * 11;
    for (let x = -span; x < span; x += 3.8 + row * 0.4 + random() * (detailed ? 1.6 : 3.3)) {
      const h = 2.0 + random() ** 0.82 * (6.9 + row * 2.3);
      const w = 1.39 + random() * 2.83, d = 1.3 + random() * 2.8;
      const position = [x, 0.12, z + (random() - 0.5) * 8.2];
      const walls = random() < 0.56 ? office : glass;
      mass(batch, walls, position, [w, h, d], 0.03 + random() * 0.14);
      mass(batch, ceramic, [x, position[1] + h, position[2]], [w * 0.70, 0.19 + random() * 0.37, d * 0.68]);
    }
  }
  batch.finish();
  city.add(skyline);
}

export function buildCity(detailed) {
  const city = new THREE.Group();
  city.name = 'city exterior';
  city.position.y = 0.43;
  city.renderOrder = 1;
  const materials = {
    ceramic: cityMaterial('#D4D4CF'),
    concrete: cityMaterial('#A1A9AB'),
    office: cityMaterial('#B0BCBF', 0.78, 2.78),
    glass: cityMaterial('#5C7D93', 0.97, 2.16),
    steel: cityMaterial('#405465'),
    accent: cityMaterial('#B8593E'),
    planting: cityMaterial('#596C50'),
  };
  addSkyAndWater(city);
  addTerraces(city, detailed, materials);
  addTransit(city, detailed, materials);
  addWaterfront(city, detailed, materials);
  addSkyline(city, detailed, materials);
  return city;
}
