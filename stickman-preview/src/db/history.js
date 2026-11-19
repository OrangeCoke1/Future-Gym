// Training history (workouts + sets tables, see db.js). Every read and write is scoped to one user: a user only
// ever sees and deletes their own records. Every function takes the Dexie instance, so tests can use a throwaway one.
import Dexie from 'dexie';

/** @typedef {import('./db.js').WorkoutRow & { sets: import('./db.js').SetRow[] }} WorkoutWithSets */

/** @returns {Promise<number>} the new workout's id */
export function createWorkout(db, userId, { startedAt, profile }) {
  return db.workouts.add({ userId, startedAt, endedAt: startedAt, setCount: 0, kcal: 0, profile: { ...profile }, note: '' });
}

/**
 * store one set and update its workout's totals, in one transaction
 * @param {{ act: string, name: string, n: number, unit: string, src: string, t: number }} entry  the engine's SetEntry
 * @param {number} kcal  the energy estimate for the visit so far
 */
export function addSet(db, userId, workoutId, entry, kcal) {
  return db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(workoutId);
    if (!w || w.userId !== userId) throw new Error('no workout ' + workoutId + ' for user ' + userId);
    const { act, name, n, unit, src, t } = entry;
    const id = await db.sets.add({ workoutId, userId, action: act, name, n, unit, src, t });
    await db.workouts.update(workoutId, { endedAt: t, setCount: w.setCount + 1, kcal: Math.round(kcal) });
    return id;
  });
}

/** the user's workouts, newest first, each with its sets in order @returns {Promise<WorkoutWithSets[]>} */
export async function listWorkouts(db, userId, limit = 20) {
  const workouts = await db.workouts.where('[userId+startedAt]').between([userId, Dexie.minKey], [userId, Dexie.maxKey])
    .reverse().limit(limit).toArray();
  const sets = await db.sets.where('workoutId').anyOf(workouts.map(w => w.id)).toArray();
  return workouts.map(w => ({ ...w, sets: sets.filter(x => x.workoutId === w.id).sort((a, b) => a.t - b.t) }));
}

/** how many workouts the user has @returns {Promise<number>} */
export const countWorkouts = (db, userId) => db.workouts.where('userId').equals(userId).count();

/** the user's all-time count per exercise, in the order of first use @returns {Promise<{ action: string, name: string, unit: string, n: number }[]>} */
export async function totalsByAction(db, userId) {
  const out = new Map();
  for (const x of (await db.sets.where('userId').equals(userId).sortBy('id'))) {
    const o = out.get(x.action) || { action: x.action, name: x.name, unit: x.unit, n: 0 };
    o.n += x.n; out.set(x.action, o);
  }
  return [...out.values()];
}

/** @returns {Promise<number>} 1 if the note was saved, 0 if the workout is not the user's */
export const setNote = (db, userId, id, note) =>
  db.workouts.where({ id, userId }).modify({ note: String(note).slice(0, 200) });

/** a workout of this user and all its sets */
export function deleteWorkout(db, userId, id) {
  return db.transaction('rw', db.workouts, db.sets, async () => {
    const w = await db.workouts.get(id);
    if (!w || w.userId !== userId) return;
    await db.sets.where('workoutId').equals(id).delete();
    await db.workouts.delete(id);
  });
}

/** every workout and set of this user (other users' records stay) */
export function clearHistory(db, userId) {
  return db.transaction('rw', db.workouts, db.sets, async () => {
    await db.sets.where('userId').equals(userId).delete();
    await db.workouts.where('userId').equals(userId).delete();
  });
}
