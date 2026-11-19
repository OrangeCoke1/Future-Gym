import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export function supportsHdr(renderer) {
  const { isWebGL2 } = renderer.capabilities;
  return isWebGL2
    ? renderer.extensions.has('EXT_color_buffer_float')
    : renderer.extensions.has('OES_texture_half_float') && renderer.extensions.has('EXT_color_buffer_half_float');
}

export function createEnvironment(renderer) {
  if (!supportsHdr(renderer)) return null;
  const source = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  try {
    return pmrem.fromScene(source, 0.04);
  } finally {
    source.dispose();
    pmrem.dispose();
  }
}

class FilmOutput extends ShaderPass {
  constructor() {
    super({
      uniforms: { tDiffuse: { value: null } },
      vertexShader: `
        varying vec2 texCoord;
        void main() {
          texCoord = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tDiffuse;
        varying vec2 texCoord;
        void main() {
          gl_FragColor = texture2D(tDiffuse, texCoord);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }
      `,
    });
    this.material.depthTest = false;
    this.material.depthWrite = false;
    this.needsSwap = false;
  }

  render(renderer, ...args) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    super.render(renderer, ...args);
  }
}

export function createBloom(renderer, scene, camera) {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    samples: Math.min(4, renderer.capabilities.maxSamples),
    type: THREE.HalfFloatType,
  });
  const composer = new EffectComposer(renderer, target);
  // The render and bloom passes share the read buffer. The last pass draws directly to the canvas.
  composer.writeBuffer.samples = 0;
  composer.writeBuffer.depthBuffer = false;
  const room = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.32, 0.55, 0.86);
  const output = new FilmOutput();
  composer.addPass(room);
  composer.addPass(bloom);
  composer.addPass(output);

  return {
    resize(w, h) {
      // Four HDR samples per shaded pixel make an uncapped Retina target expensive.
      const ratio = Math.min(renderer.getPixelRatio(), Math.sqrt(1_280_000 / (w * h)));
      composer.setPixelRatio(ratio);
      composer.setSize(w, h);
    },
    render(world, view, dt) {
      room.scene = world;
      room.camera = view;
      const toneMapping = renderer.toneMapping;
      // r149 also tone maps ordinary render targets. Keep the HDR signal linear until FilmOutput.
      renderer.toneMapping = THREE.NoToneMapping;
      try {
        composer.render(dt);
      } finally {
        renderer.toneMapping = toneMapping;
      }
    },
    dispose() {
      bloom.dispose();
      bloom.materialHighPassFilter.dispose();
      output.dispose();
      composer.dispose();
    },
  };
}
