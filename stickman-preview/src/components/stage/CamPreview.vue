<script setup>
// Camera preview on the stage: the video with the detected landmarks drawn over it (mirrored with the figure).
import { ref, onMounted } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine } from '../../composables/useEngine.js';

const { t } = useI18n();
const { engine, live } = useEngine();
const video = ref(null), canvas = ref(null);
onMounted(() => engine.attachCamera(video.value, canvas.value));
</script>

<template>
  <div
    class="cam-box"
    :class="{ mir: live.mirror }"
    :style="live.camAspect ? { aspectRatio: live.camAspect } : null"
    :hidden="!live.camAspect"
  >
    <video
      ref="video"
      playsinline
      muted
      :aria-label="t('摄像头画面')"
    />
    <canvas
      ref="canvas"
      aria-hidden="true"
    />
  </div>
</template>
