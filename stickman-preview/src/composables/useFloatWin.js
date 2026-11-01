// Floating window: drag a handle to move it, drag any corner to resize it (the opposite corner stays put). The window keeps its aspect ratio
// (height = width / aspect) and is clamped inside its bounds: the positioned parent, or the viewport (position: fixed).
import { onMounted, onBeforeUnmount } from 'vue';

/** @typedef {{ x: number, y: number, w: number }} FloatRect  left / top / width in px inside the bounds; x < 0 = not placed yet */

export const WIN_MIN = 160;
export const WIN_SMALL = 240;

/**
 * @param {import('vue').Ref<HTMLElement|null>} el  the window element (its positioned parent is the bounding box)
 * @param {FloatRect} rect  reactive state, mutated in place
 * @param {() => number} aspect  width / height of the content
 * @param {() => void} commit  called after a move / resize ends (persist)
 * @param {(w: number, h: number) => FloatRect} place  default rect for bounds of size w × h
 * @param {{ viewport?: boolean }} [o]  viewport: bound by the browser window instead of the parent (the window is position: fixed)
 */
export function useFloatWin(el, rect, aspect, commit, place, o = {}) {
  let op = null, ro = null;
  const box = () => {
    if (o.viewport) return { w: document.documentElement.clientWidth, h: document.documentElement.clientHeight };
    const p = el.value && el.value.parentElement;
    return p ? { w: p.clientWidth, h: p.clientHeight } : null;
  };
  const ar = () => { const a = Number(aspect()); return a > 0 ? a : 4 / 3; };
  /** title bar height (the first child), read directly: the window's own height lags a size change by a render */
  const headH = () => { const h = el.value && el.value.firstElementChild; return h ? h.offsetHeight : 0; };

  /** keep the window inside its bounds */
  function clamp() {
    const b = box();
    if (!b || !b.w || !b.h || !el.value.offsetHeight) return;    // parent or window not laid out (hidden)
    if (rect.x < 0) Object.assign(rect, place(b.w, b.h));
    const a = ar(), head = headH();
    const maxW = Math.max(WIN_MIN, Math.min(b.w - 8, (b.h - 16 - head) * a));
    rect.w = Math.round(Math.min(Math.max(rect.w, WIN_MIN), maxW));
    const h = rect.w / a + head;
    rect.x = Math.round(Math.min(Math.max(rect.x, 0), Math.max(0, b.w - rect.w)));
    rect.y = Math.round(Math.min(Math.max(rect.y, 0), Math.max(0, b.h - h)));
  }

  /** @param {PointerEvent} e @param {'move'|'size'|'se'|'sw'|'ne'|'nw'} kind  size = the bottom-right corner */
  function start(e, kind) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    op = { kind: kind === 'size' ? 'se' : kind, px: e.clientX, py: e.clientY, x: rect.x, y: rect.y, w: rect.w, h: rect.w / ar() + headH() };
  }
  /** @param {PointerEvent} e */
  function move(e) {
    if (!op) return;
    const dx = e.clientX - op.px, dy = e.clientY - op.py;
    if (op.kind === 'move') { rect.x = Math.max(0, op.x + dx); rect.y = Math.max(0, op.y + dy); clamp(); return; }   // x < 0 would mean "not placed"
    // corner: grow by whichever axis moved more (the aspect ratio is kept), the opposite corner stays where it was
    const sx = op.kind.includes('e') ? 1 : -1, sy = op.kind.includes('s') ? 1 : -1, a = ar(), b = box();
    const head = headH(), maxW = b ? Math.max(WIN_MIN, Math.min(b.w - 8, (b.h - 16 - head) * a)) : Infinity;
    const w = Math.round(Math.min(Math.max(op.w + Math.max(sx * dx, sy * dy * a), WIN_MIN), maxW));
    rect.w = w;
    rect.x = Math.max(0, sx > 0 ? op.x : op.x + op.w - w);
    rect.y = Math.max(0, sy > 0 ? op.y : op.y + op.h - (w / a + head));
    clamp();
  }
  function end() { if (!op) return; op = null; commit(); }

  /** cycle small → large (half the bounds' width) → as large as fits → small, keeping the right edge where it is */
  function toggleSize() {
    const b = box();
    if (!b || !el.value) return;
    const a = ar(), head = headH();
    const max = Math.round(Math.max(WIN_MIN, Math.min(b.w - 16, (b.h - 16 - head) * a))), big = Math.min(max, Math.round(b.w * 0.5));
    const right = rect.x + rect.w;
    rect.w = rect.w < big - 20 ? big : rect.w < max - 20 ? max : WIN_SMALL;
    rect.x = Math.max(0, right - rect.w);
    if (rect.w === max) { rect.x = Math.round((b.w - rect.w) / 2); rect.y = 8; }
    clamp(); commit();
  }
  /** keyboard: arrows move, Shift+arrows resize */
  function key(e) {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = 16;
    if (e.shiftKey) rect.w += (d[0] || -d[1]) * s; else { rect.x = Math.max(0, rect.x + d[0] * s); rect.y = Math.max(0, rect.y + d[1] * s); }
    clamp(); commit();
  }

  onMounted(() => {
    if (o.viewport) addEventListener('resize', clamp);
    else { const p = el.value && el.value.parentElement; if (p) { ro = new ResizeObserver(clamp); ro.observe(p); } }
    clamp();
  });
  onBeforeUnmount(() => { if (ro) ro.disconnect(); if (o.viewport) removeEventListener('resize', clamp); });

  /** as large as fits in the bounds (used to tell the size button what comes next) */
  function maxW() {
    const b = box(); if (!b || !el.value) return Infinity;
    const a = ar(); return Math.max(WIN_MIN, Math.min(b.w - 16, (b.h - 16 - headH()) * a));
  }
  return { start, move, end, toggleSize, key, clamp, maxW };
}
