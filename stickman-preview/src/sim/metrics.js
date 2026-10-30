// Estimated body metrics: heart rate (MET estimate or a real device), energy, active time, cadence.
import { clamp } from '../core/math.js';
import { ACT } from '../core/actions.js';

/** @typedef {{ w: number, age: number, sex: 'm' | 'f' }} Profile */
/** @typedef {{ hr: number, real: number | null, realT: number, kcal: number, active: number, slots: number[], slotT: number, trend: number[], trendT: number, beat: number }} MetricsState */
/** @returns {MetricsState} */
export const createMetrics = () => ({ hr: 72, real: null, realT: 0, kcal: 0, active: 0, slots: new Array(30).fill(0), slotT: 0, trend: [], trendT: 0, beat: 0 });

/** entry point for a real heart-rate source; anything that is not a positive number disconnects it */
export function setHeartRate(M, bpm, now) {
  if (Number.isFinite(+bpm) && +bpm > 0) { M.real = +bpm; M.realT = now; } else M.real = null;
}
/** the real reading, or null once it is older than 5 s */
export const realHr = (M, now) => (M.real != null && now - M.realT < 5000 ? M.real : null);

// Keytel et al. 2005, kcal/min from heart rate, weight (kg), age and sex
export const keytel = (hr, prof) => (prof.sex === 'f' ? -20.4022 + 0.4472 * hr - 0.1263 * prof.w + 0.074 * prof.age : -55.0969 + 0.6309 * hr + 0.1988 * prof.w + 0.2017 * prof.age) / 4.184;

/**
 * one frame
 * @param {MetricsState} M
 * @param {{ action: string, moving: boolean, run: boolean, rate: number, dt: number, prof: Profile, now: number }} o
 *   moving: camera mode only credits the action's MET while the person is actually moving
 * @returns {{ real: number | null, met: number }}
 */
export function updateMetrics(M, { action, moving, run, rate, dt, prof, now }) {
  const real = realHr(M, now);
  const A = ACT[action], met = moving ? A.met : ACT.idle.met, sdt = run ? dt * rate : 0;
  const target = clamp(64 + (met - 1) * 14 + (A.gait && moving ? 4 : 0), 60, 182);
  if (real != null) M.hr = real;
  else {
    M.hr += (target - M.hr) * (1 - Math.exp(-sdt / 6));
    if (!run) M.hr += (68 - M.hr) * (1 - Math.exp(-dt / 10));
  }
  const rest = 3.5 * prof.w / 200 / 60;               // 1 MET, kcal per second
  // with a real heart rate the body burns energy whether or not the demo is playing; the formula is unreliable near rest, so floor it at 1 MET
  const kps = real != null ? Math.max(rest, keytel(real, prof) / 60) : met * rest, edt = real != null ? dt : sdt;
  M.kcal += kps * edt; M.slots[M.slots.length - 1] += kps * edt;
  M.slotT += edt; if (M.slotT >= 2) { M.slotT -= 2; M.slots.shift(); M.slots.push(0); }
  if (met > 1.5) M.active += sdt;
  M.trendT += dt; if (M.trendT >= 1) { M.trendT = 0; M.trend.push(M.hr); if (M.trend.length > 30) M.trend.shift(); }
  M.beat += dt * M.hr / 60;
  return { real, met };
}

/**
 * cadence read-out: measured from the reps counted in the last 12 s in camera mode, from the demo period otherwise
 * @returns {{ value: number | '—', label: string }} label is the Chinese source text
 */
export function cadenceOf({ action, camOn, speed, repT, now }) {
  const A = ACT[action], ty = A.rep.type;
  const label = ty === 'steps' ? '步频 /分' : ty === 'none' ? '节奏 /分' : '节奏 次/分';
  if (camOn) {
    const r = repT.filter(x => now - x < 12000);
    return { value: ty !== 'none' && r.length > 1 && now - r[r.length - 1] < 5000 ? Math.round(60000 * (r.length - 1) / (r[r.length - 1] - r[0])) : '—', label };
  }
  if (ty === 'steps') return { value: Math.round(120 / (A.P / speed)), label };
  if (ty === 'none') return { value: '—', label };
  return { value: Math.round(60 / (A.P / speed)), label };
}

const zones = [[0, '静息'], [95, '热身'], [115, '燃脂'], [135, '有氧'], [155, '无氧'], [170, '极限']];
/** heart-rate zone name (Chinese source text) */
export const zoneOf = hr => zones.filter(z => hr >= z[0]).pop()[1];
