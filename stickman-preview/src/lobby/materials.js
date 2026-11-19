import * as THREE from 'three';

export const INK = '#2A2F2B';
export const WALL = '#E9DFEE';
export const DECK = '#CBBFD9';
export const LILAC = '#F4D9FF';
export const VIOLET = '#BE86FA';
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
  return {
    housing: surface('#ECE2EC', { roughness: 0.31, metalness: 0.06, envMapIntensity: 0.69 }),
    graphite: surface('#40394F', { roughness: 0.42, metalness: 0.44, envMapIntensity: 0.72 }),
    aluminum: surface('#BEBBCB', { roughness: 0.29, metalness: 0.78, envMapIntensity: 0.79 }),
    chrome: surface('#E2E0ED', { roughness: 0.17, metalness: 1, envMapIntensity: 0.92 }),
    grip: surface('#C8C2D0', { roughness: 0.29, metalness: 0.71, envMapIntensity: 0.88, roughnessMap: textures.knurl() }),
    rubber: surface('#322C40', { roughness: 0.88, envMapIntensity: 0.31 }),
    padding: surface('#776B91', { roughness: 0.69, bumpMap: textures.grain(), bumpScale: 0.0009, envMapIntensity: 0.45 }),
    mat: surface('#917EAA', { roughness: 0.85, bumpMap: textures.grain(), bumpScale: 0.0015, envMapIntensity: 0.49 }),
    roller: surface('#B38AD5', { roughness: 0.74, bumpMap: textures.roller(), bumpScale: 0.004, envMapIntensity: 0.54 }),
  };
}
