<script setup>
// The stage: WebGL figure plus the 2D overlay; drag to turn the view. Dark in the particle and moiré views.
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useEngine } from '../composables/useEngine.js';
import { useI18n } from '../i18n/useI18n.js';

const emit = defineEmits({ drag: null });          // the user turned the view by hand (ends orbit / view presets)
const { engine, live } = useEngine();
const { t } = useI18n();
const glEl = ref(null), fxEl = ref(null), noGl = ref(false);
let ro = null, drag = null;

onMounted(() => {
  noGl.value = !engine.attach(glEl.value, fxEl.value);
  const fit = () => { const r = fxEl.value.getBoundingClientRect(); engine.resize(r.width, r.height); };
  ro = new ResizeObserver(fit); ro.observe(fxEl.value); fit();
});
onBeforeUnmount(() => { if (ro) ro.disconnect(); engine.detach(); });   // frees the WebGL context; the look carries over to the next stage

function down(e) {
  drag = { x: e.clientX, y: e.clientY }; engine.setDragging(true);
  fxEl.value.setPointerCapture(e.pointerId); emit('drag');
}
function move(e) {
  if (!drag) return;
  engine.dragBy(e.clientX - drag.x, e.clientY - drag.y, e.pointerType === 'mouse');
  drag = { x: e.clientX, y: e.clientY };
}
function up() { drag = null; engine.setDragging(false); }
</script>

<template>
  <div
    class="stage"
    :class="{ holo: live.dark }"
  >
    <canvas
      ref="glEl"
      class="gl"
      aria-hidden="true"
    />
    <canvas
      ref="fxEl"
      class="fx"
      :aria-label="t('小人动画，拖动旋转视角')"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
    />
    <div
      v-if="noGl"
      class="nogl"
    >
      {{ t('当前浏览器无法启用 WebGL，小人无法显示。请换用新版 Chrome、Edge 或 Safari 打开。') }}
    </div>
    <slot />
  </div>
</template>
