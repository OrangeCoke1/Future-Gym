// Water log (entered by hand, never inferred) and the bottle level: logged intake minus the simulated sweat loss.
import { clamp } from '../core/math.js';

export const GOAL = 2000;
export const dayKey = (d = new Date()) => d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();

/** @typedef {{ t: number, ml: number }} WaterEntry */
/** @typedef {{ day: string, log: WaterEntry[] }} WaterLog */

const isEntry = e => e !== null && typeof e === 'object' && Number.isFinite(e.t) && Number.isFinite(e.ml) && e.ml > 0;
/**
 * today's log from whatever was stored: anything malformed, or from another day, starts a fresh log
 * @param {unknown} v @returns {WaterLog}
 */
export function sanitizeWater(v, day = dayKey()) {
  if (v === null || typeof v !== 'object' || v.day !== day || !Array.isArray(v.log)) return { day, log: [] };
  return { day, log: v.log.filter(isEntry).map(e => ({ t: e.t, ml: e.ml })) };
}
export const totalOf = water => water.log.reduce((s, e) => s + e.ml, 0);
/** rounded ml left in the bottle (can be negative) */
export const netOf = (total, sweatMl) => Math.round(total - sweatMl);
/** the bottle lies on its side; its straight part runs from x = 2 (empty) to 186 (GOAL) */
export const bottleWidth = net => 2 + 184 * clamp(net / GOAL, 0, 1);
