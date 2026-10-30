// A chart canvas kept at its laid-out size in device pixels (see charts/chart.js).
import { shallowRef, onMounted, onBeforeUnmount } from 'vue';
import { chartOf, sizeChart } from '../charts/chart.js';

/** @param {import('vue').Ref<HTMLCanvasElement | null>} el @returns {import('vue').ShallowRef<import('../charts/chart.js').Chart | null>} */
export function useChart(el) {
  const ch = shallowRef(null);
  let ro = null;
  onMounted(() => {
    const c = chartOf(el.value); ch.value = c; sizeChart(c);
    ro = new ResizeObserver(() => sizeChart(c)); ro.observe(el.value);
  });
  onBeforeUnmount(() => ro && ro.disconnect());
  return ch;
}
