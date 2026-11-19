import * as THREE from 'three';

export const INK = '#2A2F2B';
export const WALL = '#EEEBE0';
export const DECK = '#CDC9BC';
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
    graphite: surface(INK, { roughness: 0.45, metalness: 0.6, envMapIntensity: 0.67 }),
    aluminum: surface('#C9CCC8', { roughness: 0.3, metalness: 1, envMapIntensity: 0.76 }),
    chrome: surface('#E6E8E6', { roughness: 0.12, metalness: 1, envMapIntensity: 0.85 }),
    grip: surface('#E6E8E6', { roughness: 0.26, metalness: 1, envMapIntensity: 0.85, roughnessMap: textures.knurl() }),
    rubber: surface('#1B1E1C', { roughness: 0.9, envMapIntensity: 0.42 }),
    orange: surface(ACCENT, { roughness: 0.6, envMapIntensity: 0.52 }),
    mat: surface(ACCENT, { roughness: 0.8, bumpMap: textures.grain(), bumpScale: 0.0014, envMapIntensity: 0.54 }),
    sage: surface('#9DA58A', { roughness: 0.75, envMapIntensity: 0.6 }),
    roller: surface('#3A3F3A', { roughness: 0.75, bumpMap: textures.roller(), bumpScale: 0.004, envMapIntensity: 0.54 }),
  };
}
