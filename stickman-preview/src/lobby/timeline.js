export const HATCH_CROSS = 2.95;
export const SPLAT_LAND = 4.7;
export const INTRO_END = 5.35;
export const FLIGHT_END = 0.9;

function progress(t, start, end) { return Math.min(1, Math.max(0, (t - start) / (end - start))); }

function easeInOutCubic(p) {
  return p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2;
}

function easeOutCubic(p) { return 1 - (1 - p) ** 3; }

/** @param {number} t Elapsed seconds of the intro. */
export function phaseAt(t) {
  return {
    unlock: easeOutCubic(progress(t, 0.48, 1.16)),
    doors: easeInOutCubic(progress(t, 1.16, 2.08)),
    approach: progress(t, 1.84, HATCH_CROSS) ** 2,
    entered: t >= HATCH_CROSS,
    doorwayFade: easeInOutCubic(progress(t, HATCH_CROSS, HATCH_CROSS + 0.23)),
    advance: easeOutCubic(progress(t, HATCH_CROSS, SPLAT_LAND)),
    orbit: Math.sin(Math.PI * progress(t, HATCH_CROSS, SPLAT_LAND)) ** 2,
    room: easeOutCubic(progress(t, SPLAT_LAND, INTRO_END)),
    ready: t >= INTRO_END,
  };
}

export function flightAt(t) {
  return { position: easeInOutCubic(progress(t, 0, FLIGHT_END)), fade: progress(t, FLIGHT_END - 0.35, FLIGHT_END) };
}
