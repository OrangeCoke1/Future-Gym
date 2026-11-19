// Profile used by the energy estimates. The engine reads the same reactive object every frame.
// Logged out it is kept in localStorage; while a user is logged in it is theirs (stores/auth.js binds it to the users table).
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
  /** where changes go: null = localStorage, else the logged-in user's saver */
  let sink = null;
  watch(profile, v => (sink ? sink({ ...v }) : save('stick.profile', v)));
  /** switch to a user's profile and save changes with `saver`; bind(null) goes back to the logged-out profile */
  function bind(p, saver) {
    sink = saver || null;
    Object.assign(profile, saver ? sanitize(p) : load('stick.profile', sanitize));
  }
  /** set weight / age only when within range; anything else is ignored (the input shows the kept value on blur) */
  function setNum(key, v) { const [lo, hi] = LIMITS[key]; if (Number.isFinite(v) && v >= lo && v <= hi) profile[key] = v; }
  function setSex(s) { if (s === 'm' || s === 'f') profile.sex = s; }
  return { profile, setNum, setSex, bind };
});
