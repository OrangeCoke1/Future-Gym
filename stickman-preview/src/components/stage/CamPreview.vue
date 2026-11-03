<script setup>
// Camera preview: the video with the detected landmarks drawn over it (mirrored with the figure), in a floating window
// over the whole page (teleported to <body>, position: fixed) — drag the title bar to move it, any corner to resize it
// (up to the whole browser window), double-click or the size button to step small → large → as large as fits. It first appears at the stage's bottom-right corner.
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine } from '../../composables/useEngine.js';
import { useSettings } from '../../stores/settings.js';
import { useFloatWin } from '../../composables/useFloatWin.js';
import { layoutRef } from '../../composables/useLayout.js';

const { t } = useI18n();
const { engine, live } = useEngine();
const settings = useSettings();
const win = ref(null), video = ref(null), canvas = ref(null);
const rect = settings.camWin, stageEl = layoutRef('stage');

/** default: the stage's bottom-right, above the angle gauge, ~45% of the stage width (page coordinates) */
const place = (w, h) => {
  const st = stageEl.value, r = st ? st.getBoundingClientRect() : { left: 0, top: 0, width: w, height: h };
  const pw = Math.round(Math.min(Math.max(r.width * 0.45, 320), 480, r.width - 40));
  const ph = pw / (Number(live.camAspect) || 4 / 3) + 28;
  return { x: Math.round(r.left + r.width - pw - 20), y: Math.round(Math.max(r.top, r.top + r.height - ph - 150)), w: pw };
};
const fw = useFloatWin(win, rect, () => live.camAspect, settings.saveCamWin, place, { viewport: true });
const style = computed(() => ({ left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px' }));
/** the size button shrinks once the window is about as large as fits */
const big = computed(() => rect.w >= fw.maxW() - 24);
const CORNERS = ['se', 'sw', 'ne', 'nw'];
/** recognised gestures, by the person's own hand (the figure's sides are swapped in mirror view) */
const gestures = computed(() => (live.handG || '').split('|').filter(Boolean).map(x => {
  const [n, g] = x.split(':'), own = live.mirror ? (n === 'L' ? 'R' : 'L') : n;
  return t(own === 'L' ? '左手' : '右手') + ' ' + t(g);
}).join(' · '));

onMounted(() => engine.attachCamera(video.value, canvas.value));
// shown for the first time, aspect changed, or layout reset: place / re-clamp once laid out
watch(() => [live.camAspect, rect.x < 0], () => nextTick(fw.clamp));
</script>

<template>
  <Teleport to="body">
    <div
      ref="win"
      class="cam-win"
      :style="style"
      :hidden="!live.camAspect"
      @pointerdown.stop
    >
      <div
        class="cam-bar"
        tabindex="0"
        :title="t('拖动移动，拖四个角调整大小，双击切换大小')"
        :aria-label="t('摄像头画面浮窗，方向键移动，Shift+方向键调整大小')"
        @pointerdown="fw.start($event, 'move')"
        @pointermove="fw.move"
        @pointerup="fw.end"
        @pointercancel="fw.end"
        @dblclick="fw.toggleSize"
        @keydown="fw.key"
      >
        <span class="k">{{ t('摄像头画面') }}<span
          v-if="gestures"
          class="cam-g"
        > · {{ gestures }}</span></span>
        <button
          type="button"
          class="cam-sz"
          :aria-label="big ? t('缩小') : t('放大')"
          :title="big ? t('缩小') : t('放大')"
          @pointerdown.stop
          @click="fw.toggleSize"
        >
          {{ big ? '−' : '+' }}
        </button>
      </div>
      <div
        class="cam-box"
        :class="{ mir: live.mirror }"
        :style="live.camAspect ? { aspectRatio: live.camAspect } : null"
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
      <span
        v-for="c in CORNERS"
        :key="c"
        class="cam-rs"
        :data-c="c"
        aria-hidden="true"
        @pointerdown="fw.start($event, c)"
        @pointermove="fw.move"
        @pointerup="fw.end"
        @pointercancel="fw.end"
      />
    </div>
  </Teleport>
</template>
