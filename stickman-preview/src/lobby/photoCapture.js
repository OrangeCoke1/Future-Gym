import * as THREE from 'three';
import { lobbyRandom } from './textures.js';

export function samplePhotoDepth(packed, width, height, camera, detailed) {
  const rgba = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
  // RGBADepthPacking stores the least significant byte first. White is the clear color.
  const depthAt = pixel => rgba.getUint32(pixel * 4, true);
  const pixels = new Uint32Array(width * height);
  let visible = 0;
  for (let pixel = 0; pixel < pixels.length; pixel++) {
    if (depthAt(pixel) !== 0xffffffff) pixels[visible++] = pixel;
  }

  const count = Math.min(visible, detailed ? 70000 : 35000);
  const random = lobbyRandom(2126);
  const samples = Uint32Array.from({ length: count }, (_, i) => pixels[Math.floor((i + random()) * visible / count)]);
  samples.sort((a, b) => depthAt(b) - depthAt(a));

  const positions = new Float32Array(count * 3);
  const uvs = new Float32Array(count * 2);
  const point = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const pixel = samples[i];
    const u = (pixel % width + 0.5) / width;
    const v = (Math.floor(pixel / width) + 0.5) / height;
    point.set(2 * u - 1, 2 * v - 1, depthAt(pixel) / 0x80000000 - 1).unproject(camera);
    point.toArray(positions, i * 3);
    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }
  return { positions, uvs };
}

export function capturePhoto(renderer, room, camera, detailed) {
  const width = Math.max(1, Math.round(Math.min(960, camera.aspect * 640)));
  const height = Math.max(1, Math.min(640, Math.round(width / camera.aspect)));
  const photo = new THREE.WebGLRenderTarget(width, height);
  const depth = new THREE.WebGLRenderTarget(width, height);
  const packed = new Uint8Array(width * height * 4).fill(255);
  const previousTarget = renderer.getRenderTarget();
  const clear = renderer.getClearColor(new THREE.Color());
  const clearAlpha = renderer.getClearAlpha();
  const background = room.background;
  const depthMaterials = new Map();
  const originalMaterials = new Map();
  const hidden = [];

  try {
    renderer.setRenderTarget(photo);
    renderer.render(room, camera);

    // The depth pass also works on WebGL 1 without depth textures. Keep the room's face culling.
    room.traverseVisible(object => {
      const material = object.material;
      if (!material) return;
      if (!material.depthWrite || !material.visible) {
        hidden.push(object);
        object.visible = false;
        return;
      }
      const { side } = material;
      if (!depthMaterials.has(side)) {
        depthMaterials.set(side, new THREE.MeshDepthMaterial({
          side, depthPacking: THREE.RGBADepthPacking, blending: THREE.NoBlending,
        }));
      }
      originalMaterials.set(object, material);
      object.material = depthMaterials.get(side);
    });
    room.background = null;
    renderer.setClearColor(0xffffff, 1);
    renderer.setRenderTarget(depth);
    renderer.render(room, camera);
    renderer.readRenderTargetPixels(depth, 0, 0, width, height, packed);
    return { photo, ...samplePhotoDepth(packed, width, height, camera, detailed) };
  } catch (error) {
    photo.dispose();
    throw error;
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(clear, clearAlpha);
    room.background = background;
    for (const [object, material] of originalMaterials) object.material = material;
    for (const object of hidden) object.visible = true;
    for (const material of depthMaterials.values()) material.dispose();
    depth.dispose();
  }
}
