export const PHOTO_SETTLE = 1.3;
export const PHOTO_DISSOLVED = 2.3;
export const SPLAT_FLIGHT_START = 2;
export const SPLAT_LAND = 4;
export const INTRO_END = 4.8;
export const FLIGHT_END = 0.9;

function progress(t, start, end) { return Math.min(1, Math.max(0, (t - start) / (end - start))); }

function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
}

function easeOutCubic(p) { return 1 - (1 - p) ** 3; }

/** @param {number} t Elapsed seconds of the intro. */
export function phaseAt(t) {
  const settle = progress(t, 0.68, PHOTO_SETTLE);
  return {
    toss: easeOutCubic(progress(t, 0, 1.04)),
    rebound: Math.sin(settle * Math.PI * 2) * settle * (1 - settle),
    glint: progress(t, 0.69, PHOTO_SETTLE + 0.09),
    dissolve: progress(t, PHOTO_SETTLE, PHOTO_DISSOLVED),
    orbit: easeInOutCubic(progress(t, SPLAT_FLIGHT_START, SPLAT_LAND)),
    room: easeInOutCubic(progress(t, SPLAT_LAND, INTRO_END)),
    ready: t >= INTRO_END,
  };
}

export function flightAt(t) {
  return { position: easeInOutCubic(progress(t, 0, FLIGHT_END)), fade: progress(t, FLIGHT_END - 0.35, FLIGHT_END) };
}
