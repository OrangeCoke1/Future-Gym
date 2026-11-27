// Camera-following tuning (面板 → 摄像头跟随): the One Euro filter's cutoff at rest and its rise with speed, how far
// ahead joints are predicted, and whether the legs follow the camera. Plain data and a sanitiser, shared by the camera
// pose, the engine and the settings store.

/** @typedef {'normal' | 'auto' | 'stand'} LegMode  normal = the whole body follows the camera (unseen legs hang straight under the
 *   tilted trunk); auto = legs follow where seen well, unseen legs and the pelvis stay standing upright and only the body
 *   above the waist moves; stand = always that standing lower body */
/** @typedef {{ minCut: number, beta: number, lead: number, legs: LegMode, guard: boolean }} CamTune
 *   One Euro cutoff at rest (Hz) and its rise with speed, prediction lead (ms), leg mode, glitch guard (single-frame
 *   jumps and left / right swaps of the landmarks are thrown out) */
/** @type {Readonly<CamTune>} */
export const CAM_TUNE_DEFAULT = Object.freeze({ minCut: 1.5, beta: 6, lead: 100, legs: 'auto', guard: true });
/** @type {Record<'minCut' | 'beta' | 'lead', [number, number]>} allowed range of each numeric field */
export const CAM_TUNE_RANGE = Object.freeze({ minCut: [0.5, 5], beta: [0, 20], lead: [0, 150] });
export const LEG_MODES = /** @type {const} */ (['normal', 'auto', 'stand']);
/** the panel's presets (numeric fields only): 稳定 = least jitter, 跟手 = least lag */
export const CAM_TUNE_PRESETS = [
  ['稳定', { minCut: 0.8, beta: 3, lead: 0 }],
  ['平衡', { minCut: CAM_TUNE_DEFAULT.minCut, beta: CAM_TUNE_DEFAULT.beta, lead: CAM_TUNE_DEFAULT.lead }],
  ['跟手', { minCut: 3, beta: 12, lead: 120 }]
];
/** a valid tuning: numbers clamped to their range, a missing or invalid field taken from `fb` @returns {CamTune} */
export function sanitizeTune(v, fb = CAM_TUNE_DEFAULT) {
  const ok = v && typeof v === 'object', o = {};
  for (const k of Object.keys(CAM_TUNE_RANGE)) {
    const x = ok ? v[k] : undefined, [lo, hi] = CAM_TUNE_RANGE[k];
    o[k] = typeof x === 'number' && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fb[k];
  }
  o.legs = ok && LEG_MODES.includes(v.legs) ? v.legs : (LEG_MODES.includes(fb.legs) ? fb.legs : 'auto');
  o.guard = ok && typeof v.guard === 'boolean' ? v.guard : (typeof fb.guard === 'boolean' ? fb.guard : true);
  return o;
}
/** a saved tuning from before the leg mode existed used the older, shakier defaults: start from the new ones */
export const loadTune = v => (v && typeof v === 'object' && LEG_MODES.includes(v.legs) ? sanitizeTune(v) : { ...CAM_TUNE_DEFAULT });
