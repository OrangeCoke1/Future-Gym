// Training history of the logged-in user (用户菜单 → 我的页面 #/me), kept in IndexedDB by db/history.js. App.vue feeds it
// every set the engine logs; logged out, nothing is saved. The workout row is created with the user's first set
// of the visit; logging in as someone else starts a new one. If the database cannot be opened (private mode,
// storage blocked), `ok` turns false and the page works as before, without history.
import { defineStore } from 'pinia';
import { ref, shallowRef, watch } from 'vue';
import { sharedDb } from '../db/db.js';
import { createWorkout, addSet, listWorkouts, countWorkouts, totalsByAction, setNote, deleteWorkout, clearHistory } from '../db/history.js';
import { useAuth } from './auth.js';
import { useProfile } from './profile.js';

export const useHistory = defineStore('history', () => {
  const db = sharedDb();
  const auth = useAuth();
  const { profile } = useProfile();
  const ok = ref(true);
  /** @type {import('vue').ShallowRef<import('../db/history.js').WorkoutWithSets[]>} */
  const workouts = shallowRef([]);
  const totals = shallowRef([]);
  const count = ref(0);                                   // all of the user's workouts (the list shows the newest 20)
  /** this visit's workout { u: user id, p: promise of its id }; a promise, so two quick sets share one workout */
  let wid = null;
  // writes run one after another, so a refresh never sees half of them
  let queue = Promise.resolve();
  const uid = () => (auth.user ? auth.user.id : null);
  const run = f => (queue = queue.then(f).then(refresh).catch(e => { ok.value = false; wid = null; console.warn('[history]', e); }));

  async function refresh() {
    const u = uid();
    if (u == null) { workouts.value = []; totals.value = []; count.value = 0; return; }
    [workouts.value, totals.value, count.value] = await Promise.all([listWorkouts(db, u), totalsByAction(db, u), countWorkouts(db, u)]);
  }
  watch(() => uid(), () => { wid = null; run(() => {}); }, { immediate: true });

  /** @param {import('../engine/engine.js').SetEntry} entry @param {number} kcal */
  function record(entry, kcal) {
    const u = uid();
    if (u == null) return;
    return run(async () => {
      if (!wid || wid.u !== u) wid = { u, p: createWorkout(db, u, { startedAt: entry.t, profile }) };
      await addSet(db, u, await wid.p, entry, kcal);
    });
  }
  const note = (id, text) => { const u = uid(); return u != null && run(() => setNote(db, u, id, text)); };
  const remove = id => {
    const u = uid();
    return u != null && run(async () => { if (wid && wid.u === u && (await wid.p) === id) wid = null; await deleteWorkout(db, u, id); });
  };
  const clear = () => { const u = uid(); return u != null && run(async () => { wid = null; await clearHistory(db, u); }); };
  return { ok, workouts, totals, count, record, note, remove, clear };
});
