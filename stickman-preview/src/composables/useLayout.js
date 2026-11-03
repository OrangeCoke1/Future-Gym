// Resizable layout: column widths (--cl / --cr on .app) and the flex-grow (--g) of neighbouring cards, kept in the
// settings store (persisted). Handles are SplitHandle components; this applies the stored sizes to the cards.
import { watchEffect, onMounted } from 'vue';
import { clamp } from '../core/math.js';
import { useSettings } from '../stores/settings.js';

const rz = k => document.querySelector('[data-rz="' + k + '"]');

/** call in the page that owns the [data-rz] cards (TrainingView): keeps each card's --g in step with the store */
export function useLayoutVars() {
  const { layout } = useSettings();
  onMounted(() => watchEffect(() => {
    document.querySelectorAll('[data-rz]').forEach(el => { const g = layout.g[el.dataset.rz]; g ? el.style.setProperty('--g', g) : el.style.removeProperty('--g'); });
  }));
}

/**
 * drag logic of one handle
 * @param {{ dir: 'row' | 'col', a?: string, b?: string, col?: 'cl' | 'cr' }} o  a / b = data-rz keys of the two cards it
 *   sits between (moves flex-grow from one to the other); col = which side column's width it changes
 * @returns {{ begin: () => void, apply: (d: number) => void, done: () => void }}
 */
export function useSplit({ dir, a, b, col }) {
  const settings = useSettings(), L = settings.layout;
  let st = null;
  if (col) {
    const side = () => document.querySelector(col === 'cl' ? '.side.l' : '.side.r');
    return {
      begin() { st = side().getBoundingClientRect().width; },
      apply(d) {
        const other = document.querySelector(col === 'cl' ? '.side.r' : '.side.l').getBoundingClientRect().width, app = document.querySelector('.app');
        L[col] = Math.round(clamp(st + (col === 'cl' ? 1 : -1) * d, 190, Math.max(190, app.clientWidth - other - 420)));
      },
      done: settings.saveLayout
    };
  }
  const size = el => { const r = el.getBoundingClientRect(); return dir === 'row' ? r.height : r.width; };
  return {
    begin() { const A = rz(a), B = rz(b); st = { a: size(A), b: size(B), g: +getComputedStyle(A).flexGrow + +getComputedStyle(B).flexGrow }; },
    apply(d) {
      const tot = st.a + st.b, min = Math.min(dir === 'row' ? 60 : 88, tot / 2), na = clamp(st.a + d, min, tot - min), ga = st.g * na / tot;
      L.g = { ...L.g, [a]: +ga.toFixed(4), [b]: +(st.g - ga).toFixed(4) };
    },
    done: settings.saveLayout
  };
}
