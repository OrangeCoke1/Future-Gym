export const INTRO_END = 4.6;
export const FLIGHT_END = 0.9;

function progress(t, start, end) { return Math.min(1, Math.max(0, (t - start) / (end - start))); }

export function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
}

function easeOutCubic(p) { return 1 - (1 - p) ** 3; }

export function stationRevealAt(t, index) {
  const start = 3.6 + index * 0.12;
  return easeOutCubic(progress(t, start, start + 0.6));
}

/** @param {number} t Elapsed seconds of the intro. */
export function phaseAt(t) {
  const room = t >= 3.5;
  return {
    fadeIn: easeOutCubic(progress(t, 0, 0.8)),
    seam: easeInOutCubic(progress(t, 0.8, 1.4)),
    pop: easeOutCubic(progress(t, 1.4, 1.7)),
    lid: easeInOutCubic(progress(t, 1.7, 2.4)),
    burst: progress(t, 1.72, 2.72),
    align: easeInOutCubic(progress(t, 2.2, 3.13)),
    dolly: progress(t, 2.2, 3.5) ** 3,
    flash: room ? 1 - easeInOutCubic(progress(t, 3.5, 3.7)) : easeInOutCubic(progress(t, 3.3, 3.5)),
    room,
    pullback: easeOutCubic(progress(t, 3.6, INTRO_END)),
    reveal: easeOutCubic(progress(t, 3.77, INTRO_END)),
    ready: t >= INTRO_END,
  };
}

export function flightAt(t) {
  return { position: easeInOutCubic(progress(t, 0, FLIGHT_END)), fade: progress(t, FLIGHT_END - 0.35, FLIGHT_END) };
}
