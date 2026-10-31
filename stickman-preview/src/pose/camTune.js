// Camera-following tuning (面板 → 摄像头跟随): the One Euro filter's cutoff at rest and its rise with speed, and how far
// ahead joints are predicted. Plain data and a sanitiser, shared by the camera pose, the engine and the settings store.

/** @typedef {{ minCut: number, beta: number, lead: number }} CamTune
 *   One Euro cutoff at rest (Hz) and its rise with speed, prediction lead (ms); set from 面板 → 摄像头跟随 */
/** @type {CamTune} */
export const CAM_TUNE_DEFAULT = Object.freeze({ minCut: 2, beta: 8, lead: 80 });
/** @type {Record<keyof CamTune, [number, number]>} allowed range of each field */
export const CAM_TUNE_RANGE = Object.freeze({ minCut: [0.5, 5], beta: [0, 20], lead: [0, 150] });
/** the panel's presets: 稳定 = least jitter, 跟手 = least lag @type {[string, CamTune][]} */
export const CAM_TUNE_PRESETS = [['稳定', { minCut: 1.2, beta: 4, lead: 40 }], ['平衡', { ...CAM_TUNE_DEFAULT }], ['跟手', { minCut: 3, beta: 12, lead: 120 }]];
/** a valid tuning: each field clamped to its range, a missing or non-numeric one taken from `fb` @returns {CamTune} */
export function sanitizeTune(v, fb = CAM_TUNE_DEFAULT) {
  const o = {};
  for (const k of Object.keys(CAM_TUNE_RANGE)) {
    const x = v && typeof v === 'object' ? v[k] : undefined, [lo, hi] = CAM_TUNE_RANGE[k];
    o[k] = typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fb[k];
  }
  return o;
}
