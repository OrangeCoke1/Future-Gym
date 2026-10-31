// Floating window inside a positioned parent: drag a handle to move it, drag the corner to resize it.
// The window keeps its aspect ratio (height = width / aspect) and is clamped inside the parent.
import { onMounted, onBeforeUnmount } from 'vue';

/** @typedef {{ x: number, y: number, w: number }} FloatRect  left / top / width in px inside the parent; x < 0 = not placed yet */

export const WIN_MIN = 160;
export const WIN_SMALL = 240;

/**
 * @param {import('vue').Ref<HTMLElement|null>} el  the window element (its positioned parent is the bounding box)
 * @param {FloatRect} rect  reactive state, mutated in place
 * @param {() => number} aspect  width / height of the content
 * @param {() => void} commit  called after a move / resize ends (persist)
 * @param {(w: number, h: number) => FloatRect} place  default rect for a parent of size w × h
 */
export function useFloatWin(el, rect, aspect, commit, place) {
  let op = null, ro = null;
  const box = () => {
    const p = el.value && el.value.parentElement;
    return p ? { w: p.clientWidth, h: p.clientHeight } : null;
  };
  const ar = () => { const a = Number(aspect()); return a > 0 ? a : 4 / 3; };

  /** keep the window inside the parent */
  function clamp() {
    const b = box();
    if (!b || !b.w || !b.h || !el.value.offsetHeight) return;    // parent or window not laid out (hidden)
    if (rect.x < 0) Object.assign(rect, place(b.w, b.h));
    const a = ar(), head = el.value.offsetHeight - rect.w / a;   // title bar height
    const maxW = Math.max(WIN_MIN, Math.min(b.w - 8, (b.h - 8 - head) * a));
    rect.w = Math.round(Math.min(Math.max(rect.w, WIN_MIN), maxW));
    const h = rect.w / a + head;
    rect.x = Math.round(Math.min(Math.max(rect.x, 0), Math.max(0, b.w - rect.w)));
    rect.y = Math.round(Math.min(Math.max(rect.y, 0), Math.max(0, b.h - h)));
  }

  /** @param {PointerEvent} e @param {'move'|'size'} kind */
  function start(e, kind) {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    op = { kind, px: e.clientX, py: e.clientY, x: rect.x, y: rect.y, w: rect.w };
  }
  /** @param {PointerEvent} e */
  function move(e) {
    if (!op) return;
    const dx = e.clientX - op.px, dy = e.clientY - op.py;
    if (op.kind === 'move') { rect.x = op.x + dx; rect.y = op.y + dy; }
    else rect.w = op.w + Math.max(dx, dy * ar());              // corner: follow whichever axis moved more
    clamp();
  }
  function end() { if (!op) return; op = null; commit(); }

  /** small ↔ large (half the parent width) */
  function toggleSize() {
    const b = box();
    if (!b) return;
    const big = Math.round(b.w * 0.5), right = rect.x + rect.w;   // keep the right edge where it is
    rect.w = rect.w < (big + WIN_SMALL) / 2 ? big : WIN_SMALL;
    rect.x = right - rect.w;
    clamp(); commit();
  }
  /** keyboard: arrows move, Shift+arrows resize */
  function key(e) {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (!d) return;
    e.preventDefault();
    const s = 16;
    if (e.shiftKey) rect.w += (d[0] || -d[1]) * s; else { rect.x += d[0] * s; rect.y += d[1] * s; }
    clamp(); commit();
  }

  onMounted(() => {
    const p = el.value && el.value.parentElement;
    if (p) { ro = new ResizeObserver(clamp); ro.observe(p); }
    clamp();
  });
  onBeforeUnmount(() => ro && ro.disconnect());

  return { start, move, end, toggleSize, key, clamp };
}
