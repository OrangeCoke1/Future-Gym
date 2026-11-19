export const INTRO_END = 4.3;

function progress(t, start, end) { return Math.min(1, Math.max(0, (t - start) / (end - start))); }

export function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
}

export function easeOutBack(p) {
  if (p === 0 || p === 1) return p;
  const d = p - 1;
  return 1 + 2.22 * d ** 3 + 1.22 * d ** 2;
}

export function stationRevealAt(t, index) {
  const start = 3.2 + index * 0.12;
  return 1 - (1 - progress(t, start, start + 0.74)) ** 3;
}

/** @param {number} t Elapsed seconds of the intro. */
export function phaseAt(t) {
  return {
    seam: easeInOutCubic(progress(t, 0.6, 1.3)),
    lid: Math.min(1, easeOutBack(progress(t, 1.1, 2.3))),
    burst: 1 - (1 - progress(t, 1.3, 2.4)) ** 2,
    dolly: easeInOutCubic(progress(t, 2, 3.6)),
    reveal: 1 - (1 - progress(t, 3.2, INTRO_END)) ** 3,
    ready: t >= INTRO_END,
  };
}

export function lidAngleAt(t) {
  return -110 * Math.PI / 180 * easeOutBack(progress(t, 1.1, 2.3));
}
