// db/: users 1 — n workouts 1 — n sets, run against an in-memory IndexedDB. Accounts (hashing, unique names, login
// errors) and the history functions, which must never read or delete another user's records.
import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { openDb } from '../src/db/db.js';
import { register, login, getUser, saveProfile } from '../src/db/users.js';
import { createWorkout, addSet, listWorkouts, totalsByAction, setNote, deleteWorkout, clearHistory } from '../src/db/history.js';

const P = { w: 65, age: 30, sex: 'm' };
const set = (act, name, n, t, unit = '次') => ({ act, name, n, unit, src: '演示', t });
let db;
beforeEach(() => { db = openDb('test-' + Math.random()); });
afterEach(() => db.delete());

describe('users', () => {
  test('register stores a salted hash, never the password; login checks it', async () => {
    const u = await register(db, ' aki ', 'pass1234', P);
    expect(u).toEqual({ id: u.id, username: 'aki', profile: P });
    const row = await db.users.get(u.id);
    expect(JSON.stringify(row)).not.toContain('pass1234');
    expect(row.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(row.passHash).toMatch(/^[0-9a-f]{64}$/);
    expect(await login(db, 'aki', 'pass1234')).toEqual(u);
  });
  test('same password, different salt → different hash', async () => {
    const a = await register(db, 'a', 'same', P), b = await register(db, 'b', 'same', P);
    expect((await db.users.get(a.id)).passHash).not.toBe((await db.users.get(b.id)).passHash);
  });
  test('invalid input and duplicate names are refused', async () => {
    await expect(register(db, '', 'pass', P)).rejects.toThrow('用户名需要 1–20 个字');
    await expect(register(db, 'x'.repeat(21), 'pass', P)).rejects.toThrow('用户名需要 1–20 个字');
    await expect(register(db, 'aki', '123', P)).rejects.toThrow('密码至少 4 位');
    await register(db, 'aki', 'pass', P);
    await expect(register(db, 'aki', 'other', P)).rejects.toThrow('这个用户名已被使用');
  });
  test('wrong password and unknown name give the same error', async () => {
    await register(db, 'aki', 'pass', P);
    await expect(login(db, 'aki', 'nope')).rejects.toThrow('用户名或密码不正确');
    await expect(login(db, 'nobody', 'pass')).rejects.toThrow('用户名或密码不正确');
  });
  test('getUser after a reload, profile saved per user', async () => {
    const u = await register(db, 'aki', 'pass', P);
    await saveProfile(db, u.id, { w: 50, age: 20, sex: 'f' });
    expect((await getUser(db, u.id)).profile).toEqual({ w: 50, age: 20, sex: 'f' });
    expect(await getUser(db, 999)).toBeNull();
    expect(await getUser(db, null)).toBeNull();
  });
});

describe('history', () => {
  test('a set updates its workout totals', async () => {
    const id = await createWorkout(db, 1, { startedAt: 1000, profile: P });
    await addSet(db, 1, id, set('squat', '深蹲', 12, 2000), 10.4);
    await addSet(db, 1, id, set('jog', '慢跑', 40, 5000, '步'), 21.6);
    const [w] = await listWorkouts(db, 1);
    expect(w).toMatchObject({ id, userId: 1, startedAt: 1000, endedAt: 5000, setCount: 2, kcal: 22, profile: P, note: '' });
    expect(w.sets.map(x => [x.action, x.n, x.unit, x.userId])).toEqual([['squat', 12, '次', 1], ['jog', 40, '步', 1]]);
  });
  test('workouts newest first, totals per exercise across workouts', async () => {
    const a = await createWorkout(db, 1, { startedAt: 1, profile: P });
    await addSet(db, 1, a, set('squat', '深蹲', 10, 2), 1);
    const b = await createWorkout(db, 1, { startedAt: 100, profile: P });
    await addSet(db, 1, b, set('squat', '深蹲', 5, 101), 1);
    await addSet(db, 1, b, set('curl', '弯举', 8, 102), 1);
    expect((await listWorkouts(db, 1)).map(w => w.id)).toEqual([b, a]);
    expect(await totalsByAction(db, 1)).toEqual([
      { action: 'squat', name: '深蹲', unit: '次', n: 15 }, { action: 'curl', name: '弯举', unit: '次', n: 8 }]);
  });
  test('each user sees, edits and deletes only their own records', async () => {
    const a = await createWorkout(db, 1, { startedAt: 1, profile: P });
    const b = await createWorkout(db, 2, { startedAt: 2, profile: P });
    await addSet(db, 1, a, set('squat', '深蹲', 3, 3), 0);
    await addSet(db, 2, b, set('curl', '弯举', 4, 4), 0);
    expect((await listWorkouts(db, 1)).map(w => w.id)).toEqual([a]);
    expect((await totalsByAction(db, 2)).map(x => x.action)).toEqual(['curl']);
    await expect(addSet(db, 1, b, set('squat', '深蹲', 1, 5), 0)).rejects.toThrow();     // user 1 cannot add to user 2's workout
    expect(await setNote(db, 1, b, 'x')).toBe(0);
    await deleteWorkout(db, 1, b);
    await clearHistory(db, 1);
    expect(await db.workouts.toArray()).toMatchObject([{ id: b, userId: 2, note: '' }]);
    expect((await db.sets.toArray()).map(x => x.workoutId)).toEqual([b]);
  });
  test('note, delete with its sets', async () => {
    const a = await createWorkout(db, 1, { startedAt: 1, profile: P });
    await addSet(db, 1, a, set('squat', '深蹲', 3, 3), 0);
    expect(await setNote(db, 1, a, '状态不错')).toBe(1);
    expect((await db.workouts.get(a)).note).toBe('状态不错');
    await deleteWorkout(db, 1, a);
    expect(await db.workouts.count() + await db.sets.count()).toBe(0);
  });
});
