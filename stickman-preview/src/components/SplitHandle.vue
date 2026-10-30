<script setup>
// The gap between two cards, doubling as a drag handle (pointer, or Tab + arrow keys). 'row' = cards stacked
// (drag up / down), 'col' = side by side. See useSplit for what a drag changes.
import { ref } from 'vue';
import { useI18n } from '../i18n/useI18n.js';
import { useSplit } from '../composables/useLayout.js';

const props = defineProps({
  dir: { type: String, required: true, validator: v => v === 'row' || v === 'col' },
  a: { type: String, default: '' },
  b: { type: String, default: '' },
  col: { type: String, default: '', validator: v => v === '' || v === 'cl' || v === 'cr' }
});
const { t } = useI18n();
const { begin, apply, done } = useSplit({ dir: props.dir, a: props.a, b: props.b, col: props.col });
const dragging = ref(false);
let from = null;
const pos = e => (props.dir === 'row' ? e.clientY : e.clientX);

function down(e) {
  from = pos(e); begin(); e.currentTarget.setPointerCapture(e.pointerId); dragging.value = true;
  document.body.classList.add('resizing'); document.body.style.cursor = props.dir === 'row' ? 'row-resize' : 'col-resize'; e.preventDefault();
}
function move(e) { if (from !== null) apply(pos(e) - from); }
function end() {
  if (from === null) return;
  from = null; dragging.value = false; document.body.classList.remove('resizing'); document.body.style.cursor = ''; done();
}
function key(e) {
  const step = { ArrowUp: -16, ArrowLeft: -16, ArrowDown: 16, ArrowRight: 16 }[e.key];
  if (!step || (props.dir === 'row') !== (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return;
  e.preventDefault(); begin(); apply(step); done();
}
</script>

<template>
  <div
    class="split"
    :class="[dir, { drag: dragging }]"
    tabindex="0"
    role="separator"
    :aria-orientation="dir === 'row' ? 'horizontal' : 'vertical'"
    :aria-label="t('拖动调整两侧卡片的大小')"
    :style="col ? { gridColumn: col === 'cl' ? '2' : '4' } : null"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="end"
    @pointercancel="end"
    @keydown="key"
  />
</template>
