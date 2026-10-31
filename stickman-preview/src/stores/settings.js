// UI settings: language (persisted), display toggles, figure look and colour, view preset, card layout (persisted).
import { defineStore } from 'pinia';
import { reactive, ref, watch } from 'vue';
import { load, save, isObj, numIn } from '../utils/storage.js';
import { LANGS } from '../i18n/messages.js';
import { sanitizeTune, loadTune, CAM_TUNE_DEFAULT } from '../pose/camTune.js';

/** @typedef {{ cl: number, cr: number, g: Record<string, number> }} Layout  column widths (px, 0 = default) and card flex-grow by data-rz key */

const sanitizeLang = v => (LANGS.includes(v) ? v : 'zh');
/** @returns {Layout} */
const sanitizeLayout = v => {
  if (!isObj(v)) return { cl: 0, cr: 0, g: {} };
  const g = {};
  if (isObj(v.g)) for (const [k, x] of Object.entries(v.g)) { const n = numIn(x, 0.01, 100, 0); if (n) g[k] = n; }
  return { cl: numIn(v.cl, 0, 4000, 0), cr: numIn(v.cr, 0, 4000, 0), g };
};

/** @returns {import('../composables/useFloatWin.js').FloatRect & { page: true }} camera preview window in page coordinates;
 *   x = -1 → default place. Rects saved before the window could leave the stage (no `page`) were stage-relative: re-place them */
const sanitizeCamWin = v => {
  if (!isObj(v) || v.page !== true) return { x: -1, y: -1, w: 320, page: true };
  const x = numIn(v.x, 0, 8000, -1), y = numIn(v.y, 0, 8000, -1);
  return { x: y < 0 ? -1 : x, y: x < 0 ? -1 : y, w: numIn(v.w, 160, 8000, 320), page: true };
};

export const VIEWS = [['正面', 0], ['3/4', -0.62], ['侧面', -1.5708], ['背面', 3.1416]];
export const COLORS = [['#1D231E', '墨色'], ['#E0704A', '橙'], ['#6F7F5A', '橄榄绿'], ['#6E84A8', '灰蓝'], ['#FBFAF2', '白']];

export const useSettings = defineStore('settings', () => {
  const lang = ref(load('stick.lang', sanitizeLang));
  watch(lang, v => save('stick.lang', v));
  /** camera view: 'live' follows the person, 'replay' re-enacts the recognised exercise */
  const camView = ref(load('stick.camView', v => (v === 'replay' ? 'replay' : 'live')));
  watch(camView, v => save('stick.camView', v));
  /** @type {import('../engine/engine.js').DisplayOpts} */
  const opts = reactive({ muscle: true, oxy: true, shade: true, line: false, angle: true, dots: false, orbit: false });
  const color = ref(COLORS[0][0]);
  const view = ref(-0.62);                                // pressed view preset, null after a manual drag
  const layout = reactive(load('stick.layout', sanitizeLayout));
  const saveLayout = () => save('stick.layout', layout);
  const camWin = reactive(load('stick.camWin', sanitizeCamWin));
  const saveCamWin = () => save('stick.camWin', camWin);
  /** hand tracking in camera mode (面板 → 摄像头跟随 → 手部识别), persisted, off by default */
  const camHands = ref(load('stick.camHands', v => v === true));
  watch(camHands, v => save('stick.camHands', v));
  /** pose model (面板 → 识别精度): 'heavy' = 高精度, 'full' = 标准 */
  const camModel = ref(load('stick.camModel', v => (v === 'full' || v === 'heavy' ? v : undefined)) || 'heavy');
  watch(camModel, v => save('stick.camModel', v));
  /** body model (面板 → 显示 → 人体模型): 'male' (male_body.glb), 'xbot' or 'michelle' (rigged, with finger bones) */
  const body = ref(load('stick.body', v => (v === 'xbot' || v === 'michelle' ? v : 'male')));
  watch(body, v => save('stick.body', v));
  /** camera following (面板 → 摄像头跟随), persisted @type {import('../pose/camTune.js').CamTune} */
  const camTune = reactive(load('stick.camTune', loadTune));
  /** @param {Partial<import('../pose/camTune.js').CamTune> | null} p  null = back to defaults */
  function setCamTune(p) { Object.assign(camTune, p ? sanitizeTune(p, camTune) : { ...CAM_TUNE_DEFAULT }); save('stick.camTune', { ...camTune }); }
  function resetLayout() {
    layout.cl = layout.cr = 0; layout.g = {}; saveLayout();
    Object.assign(camWin, sanitizeCamWin(null)); saveCamWin();
  }
  return { lang, camView, opts, color, view, layout, saveLayout, camWin, saveCamWin, resetLayout, camTune, setCamTune, camHands, camModel, body };
});
