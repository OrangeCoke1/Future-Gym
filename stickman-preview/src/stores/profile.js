// Profile used by the energy estimates (persisted). The engine reads the same reactive object every frame.
import { defineStore } from 'pinia';
import { reactive, watch } from 'vue';
import { load, save, isObj, numIn } from '../utils/storage.js';

export const LIMITS = { w: [30, 200], age: [10, 99] };
/** @returns {import('../sim/metrics.js').Profile} */
const sanitize = v => {
  const o = isObj(v) ? v : {};
  return { w: numIn(o.w, ...LIMITS.w, 65), age: numIn(o.age, ...LIMITS.age, 30), sex: o.sex === 'f' ? 'f' : 'm' };
};

export const useProfile = defineStore('profile', () => {
  const profile = reactive(load('stick.profile', sanitize));
  watch(profile, v => save('stick.profile', v));
  /** set weight / age only when within range; anything else is ignored (the input shows the kept value on blur) */
  function setNum(key, v) { const [lo, hi] = LIMITS[key]; if (Number.isFinite(v) && v >= lo && v <= hi) profile[key] = v; }
  function setSex(s) { if (s === 'm' || s === 'f') profile.sex = s; }
  return { profile, setNum, setSex };
});
