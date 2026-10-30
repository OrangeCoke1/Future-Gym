// 2126 concept layer: which muscle groups an action loads (name, peak level, body zones tinted on the figure).
// Simulated from the selected action and how deep the movement currently is; not a measurement.
import { clamp } from '../core/math.js';

export const ZONE = { thL: 0, thR: 1, calfL: 2, calfR: 3, uaL: 4, uaR: 5, faL: 6, faR: 7, tLo: 8, tUp: 9 };
/** @type {Record<string, [string, number, string[]][]>} */
export const MUS = {
  idle: [], turn: [['核心', 0.25, ['tLo']], ['小腿', 0.2, ['calf']]],
  walk: [['小腿', 0.4, ['calf']], ['股四头肌', 0.3, ['th']], ['臀大肌', 0.25, ['tLo']]],
  wave: [['三角肌', 0.35, ['uaR']], ['前臂', 0.3, ['faR']]],
  squat: [['股四头肌', 0.9, ['th']], ['臀大肌', 0.75, ['tLo']], ['小腿', 0.3, ['calf']]],
  lunge: [['股四头肌', 0.85, ['th']], ['臀大肌', 0.8, ['tLo']], ['小腿', 0.35, ['calf']]],
  jog: [['小腿', 0.65, ['calf']], ['股四头肌', 0.55, ['th']], ['臀大肌', 0.45, ['tLo']]],
  high: [['股四头肌', 0.75, ['th']], ['小腿', 0.6, ['calf']], ['核心', 0.55, ['tLo']]],
  jacks: [['小腿', 0.65, ['calf']], ['三角肌', 0.6, ['ua']], ['股四头肌', 0.4, ['th']]],
  curl: [['肱二头肌', 0.9, ['ua']], ['前臂', 0.5, ['fa']]],
  press: [['三角肌', 0.9, ['ua']], ['上背', 0.55, ['tUp']], ['前臂', 0.3, ['fa']]],
  lateral: [['三角肌', 0.9, ['ua']], ['斜方肌', 0.5, ['tUp']], ['前臂', 0.25, ['fa']]]
};

/** @typedef {{ musE: number, FAT: Record<string, number>, musAct: number[] }} MuscleState */
/** @returns {MuscleState} */
export const createMuscles = () => ({ musE: 0, FAT: {}, musAct: new Array(10).fill(0) });

/**
 * target effort 0–1: follows how far into the rep the joint is, flat 0.85 for rules without an angle range
 * @param {boolean} active  counting is running (demo playing, or a person moving in front of the camera)
 */
export function effortOf(rule, curAngle, P, D, active) {
  if (!active) return 0;
  if (rule.th && curAngle != null) {
    const [lo, hi] = rule.th, depth = rule.enter(lo - 1, P, D) ? (hi - curAngle) / (hi - lo) : (curAngle - lo) / (hi - lo);
    return 0.3 + 0.7 * clamp(depth, 0, 1);
  }
  return 0.85;
}

/**
 * one frame: smoothed effort, per-zone tint for the figure, fatigue build-up / recovery
 * @param {MuscleState} st
 * @param {{ action: string, eff: number, tint: boolean, dt: number }} o  tint = the 肌群 display toggle
 * @returns {number} predicted recovery time in hours (0 = recovered)
 */
export function updateMuscles(st, { action, eff, tint, dt }) {
  st.musE += (eff - st.musE) * (1 - Math.exp(-dt / 0.18));
  st.musAct.fill(0);
  if (tint) for (const [, lvl, zones] of MUS[action]) for (const z of zones) for (const k of (z in ZONE ? [z] : [z + 'L', z + 'R'])) st.musAct[ZONE[k]] = Math.max(st.musAct[ZONE[k]], lvl * st.musE);
  // fatigue: every group recovers slowly all the time and builds up while it is being loaded
  const FAT = st.FAT, rec = Math.exp(-dt / 240);
  for (const k in FAT) FAT[k] *= rec;
  for (const [name, lvl] of MUS[action]) FAT[name] = Math.min(1, (FAT[name] || 0) + lvl * st.musE * 0.012 * dt);
  let top = 0, sum = 0, n = 0;
  for (const k in FAT) { top = Math.max(top, FAT[k]); sum += FAT[k]; n++; }
  return top < 0.02 ? 0 : Math.round(1 + 22 * top + 6 * sum / n);
}
