// The app's IndexedDB database (via Dexie). Three tables, one-to-many down the chain:
//   users    — local accounts on this browser: unique username, salted password hash, profile
//   workouts — one per page visit that logged anything, owned by a user
//   sets     — one per logged exercise, in a workout (userId repeated so all-time totals need no join)
// Settings stay in localStorage (utils/storage.js); records that belong to a user live here.
import Dexie from 'dexie';

export const DB_NAME = 'fitcapsule';

/**
 * @typedef {import('../sim/metrics.js').Profile} Profile
 * @typedef {{ id?: number, username: string, passHash: string, salt: string, createdAt: number, profile: Profile }} UserRow
 * @typedef {{ id?: number, userId: number, startedAt: number, endedAt: number, setCount: number, kcal: number,
 *   profile: Profile, note: string }} WorkoutRow
 * @typedef {{ id?: number, workoutId: number, userId: number, action: string, name: string, n: number, unit: string,
 *   src: string, t: number }} SetRow  name / unit / src are the Chinese source text (the UI translates them), action is the ACT key
 * @typedef {Dexie & { users: Dexie.Table<UserRow, number>, workouts: Dexie.Table<WorkoutRow, number>, sets: Dexie.Table<SetRow, number> }} Db
 */

/** @param {string} [name] @returns {Db} */
export function openDb(name = DB_NAME) {
  const db = new Dexie(name);
  // schema v1: primary key first (++ = auto-increment), then the indexes (& = unique, [a+b] = compound);
  // other fields are stored but not indexed
  db.version(1).stores({
    users: '++id, &username',
    workouts: '++id, userId, [userId+startedAt]',
    sets: '++id, workoutId, userId, action'
  });
  return /** @type {any} */ (db);
}

let shared = null;
/** the app's one database connection (stores share it; tests open their own with openDb) */
export const sharedDb = () => (shared ||= openDb());
