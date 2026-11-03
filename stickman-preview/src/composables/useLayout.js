// Resizable layout: column widths (--cl / --cr on .app) and the flex-grow (--g) of neighbouring cards, kept in the
// settings store (persisted). Handles are SplitHandle components. The elements they measure are template refs shared
// through provide / inject: provideLayout in AppLayout, layoutRef / useCard in the components that own the elements.
import { provide, inject, shallowRef, computed } from 'vue';
import { clamp } from '../core/math.js';
import { useSettings } from '../stores/settings.js';

/** @typedef {import('vue').ShallowRef<HTMLElement | null>} ElRef */
/** @typedef {{ el: { app: ElRef, cl: ElRef, cr: ElRef, stage: ElRef }, cards: Map<string, ElRef> }} LayoutCtx  cards by data-rz key */

const KEY = Symbol('layout');

/** call in AppLayout and bind the returned el.app to the .app grid @returns {LayoutCtx} */
export function provideLayout() {
  const ctx = { el: { app: shallowRef(null), cl: shallowRef(null), cr: shallowRef(null), stage: shallowRef(null) }, cards: new Map() };
  provide(KEY, ctx);
  return ctx;
}

/** @returns {LayoutCtx} */
function useCtx() {
  const ctx = inject(KEY, null);
  if (!ctx) throw new Error('layout element outside AppLayout (provideLayout())');
  return ctx;
}

/** template ref for one of the layout's elements: 'cl' / 'cr' (the side columns) or 'stage'; bind it with ref="…"
 * @param {'cl' | 'cr' | 'stage'} name @returns {ElRef} */
export function layoutRef(name) { return useCtx().el[name]; }

/**
 * a resizable card: bind `el` as the root's ref and `style` (the stored --g) next to its data-rz key
 * @param {string} key  the data-rz key @returns {{ el: ElRef, style: import('vue').ComputedRef<Record<string, number> | null> }}
 */
export function useCard(key) {
  const { cards } = useCtx(), { layout } = useSettings();
  const el = shallowRef(null);
  cards.set(key, el);                                     // the latest card with this key wins; Vue empties the ref on unmount
  return { el, style: computed(() => (layout.g[key] ? { '--g': layout.g[key] } : null)) };
}

/**
 * drag logic of one handle
 * @param {{ dir: 'row' | 'col', a?: string, b?: string, col?: 'cl' | 'cr' }} o  a / b = data-rz keys of the two cards it
 *   sits between (moves flex-grow from one to the other); col = which side column's width it changes
 * @returns {{ begin: () => void, apply: (d: number) => void, done: () => void }}
 */
export function useSplit({ dir, a, b, col }) {
  const settings = useSettings(), L = settings.layout, { el, cards } = useCtx();
  let st = null;
  if (col) {
    const other = col === 'cl' ? 'cr' : 'cl';
    return {
      begin() { st = el[col].value.getBoundingClientRect().width; },
      apply(d) {
        const ow = el[other].value.getBoundingClientRect().width;
        L[col] = Math.round(clamp(st + (col === 'cl' ? 1 : -1) * d, 190, Math.max(190, el.app.value.clientWidth - ow - 420)));
      },
      done: settings.saveLayout
    };
  }
  const size = e => { const r = e.getBoundingClientRect(); return dir === 'row' ? r.height : r.width; };
  return {
    begin() { const A = cards.get(a).value, B = cards.get(b).value; st = { a: size(A), b: size(B), g: +getComputedStyle(A).flexGrow + +getComputedStyle(B).flexGrow }; },
    apply(d) {
      const tot = st.a + st.b, min = Math.min(dir === 'row' ? 60 : 88, tot / 2), na = clamp(st.a + d, min, tot - min), ga = st.g * na / tot;
      L.g = { ...L.g, [a]: +ga.toFixed(4), [b]: +(st.g - ga).toFixed(4) };
    },
    done: settings.saveLayout
  };
}
