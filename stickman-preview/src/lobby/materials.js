import * as THREE from 'three';

export const INK = '#2A2F2B';
export const WALL = '#BEC3AD';
export const DECK = '#A5AC98';
export const GLOW = '#FFF4E2';
export const ACCENT = '#E0704A';

// The training renderer still relies on r149's legacy color inputs.
export const color = hex => new THREE.Color(hex).convertSRGBToLinear();

function showroomFinish(shader) {
  // Reserve the HDR range for emitters while preserving the hue of reflections on white panels and chrome.
  shader.fragmentShader = shader.fragmentShader.replace('#include <tonemapping_fragment>', `
    float luminance = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor.rgb *= 0.82 / max(luminance, 0.82);
    #include <tonemapping_fragment>
  `);
}

export function surface(hex, options = {}) {
  const material = new THREE.MeshStandardMaterial({ color: color(hex), ...options });
  material.onBeforeCompile = showroomFinish;
  return material;
}

export function lightMaterial(hex = GLOW, strength = 2.5, options = {}) {
  return new THREE.MeshBasicMaterial({ color: color(hex).multiplyScalar(strength), ...options });
}

export function createEquipmentMaterials(textures) {
  const grain = textures.grain();
  return {
    housing: surface('#E9E8D8', { roughness: 0.34, metalness: 0.09, bumpMap: grain, bumpScale: 0.0004, envMapIntensity: 0.69 }),
    graphite: surface('#2E3731', { roughness: 0.48, metalness: 0.37, envMapIntensity: 0.63 }),
    aluminum: surface('#ADB3AC', { roughness: 0.32, metalness: 0.74, envMapIntensity: 0.79 }),
    chrome: surface('#DEE3DF', { roughness: 0.19, metalness: 1, envMapIntensity: 0.92 }),
    grip: surface('#A7ADA6', { roughness: 0.41, metalness: 0.71, envMapIntensity: 0.86, roughnessMap: textures.knurl() }),
    rubber: surface('#1D231E', { roughness: 0.87, envMapIntensity: 0.31 }),
    padding: surface('#4B5449', { roughness: 0.73, bumpMap: grain, bumpScale: 0.0016, envMapIntensity: 0.43 }),
    mat: surface('#535D52', { roughness: 0.87, bumpMap: grain, bumpScale: 0.0021, envMapIntensity: 0.43 }),
    roller: surface('#6D8390', { roughness: 0.77, bumpMap: textures.roller(), bumpScale: 0.004, envMapIntensity: 0.51 }),
  };
}
