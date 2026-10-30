// UI settings: language (persisted), display toggles, figure look and colour, view preset, card layout (persisted).
import { defineStore } from 'pinia';
import { reactive, ref, watch } from 'vue';
import { load, save, isObj, numIn } from '../utils/storage.js';
import { LANGS } from '../i18n/messages.js';

/** @typedef {{ cl: number, cr: number, g: Record<string, number> }} Layout  column widths (px, 0 = default) and card flex-grow by data-rz key */

const sanitizeLang = v => (LANGS.includes(v) ? v : 'zh');
/** @returns {Layout} */
const sanitizeLayout = v => {
  if (!isObj(v)) return { cl: 0, cr: 0, g: {} };
  const g = {};
  if (isObj(v.g)) for (const [k, x] of Object.entries(v.g)) { const n = numIn(x, 0.01, 100, 0); if (n) g[k] = n; }
  return { cl: numIn(v.cl, 0, 4000, 0), cr: numIn(v.cr, 0, 4000, 0), g };
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
  function resetLayout() { layout.cl = layout.cr = 0; layout.g = {}; saveLayout(); }
  return { lang, camView, opts, color, view, layout, saveLayout, resetLayout };
});
