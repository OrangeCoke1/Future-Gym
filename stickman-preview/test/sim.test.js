// sim/: estimated heart rate and energy, a connected heart-rate device, simulated sweat, the water log.
import { describe, test, expect } from 'vitest';
import { createMetrics, updateMetrics, setHeartRate, keytel, zoneOf } from '../src/sim/metrics.js';
import { createBio, updateBio } from '../src/sim/bio.js';
import { sanitizeWater, totalOf, netOf, bottleWidth, GOAL } from '../src/sim/hydration.js';

const prof = { w: 65, age: 30, sex: 'm' };
const DT = 1 / 30;
/** run `sec` seconds of one action; returns the heart rate and energy after each second */
function run(M, action, sec, t0 = 0, o = {}) {
  const out = [];
  for (let i = 1; i <= sec * 30; i++) {
    updateMetrics(M, { action, moving: true, run: true, rate: 1, dt: DT, prof, now: t0 + i * DT * 1000, ...o });
    if (i % 30 === 0) out.push({ hr: M.hr, kcal: M.kcal });
  }
  return out;
}

describe('heart rate and energy (estimated)', () => {
  test('stays within 60–182 bpm and rises more for harder actions', () => {
    const idle = run(createMetrics(), 'idle', 120), squat = run(createMetrics(), 'squat', 120), jog = run(createMetrics(), 'jog', 120);
    for (const s of [idle, squat, jog]) for (const { hr } of s) { expect(hr).toBeGreaterThanOrEqual(60); expect(hr).toBeLessThanOrEqual(182); }
    expect(squat.at(-1).hr).toBeGreaterThan(idle.at(-1).hr + 20);
  });
  test('energy only accumulates', () => {
    const s = run(createMetrics(), 'squat', 60);
    for (let i = 1; i < s.length; i++) expect(s[i].kcal).toBeGreaterThanOrEqual(s[i - 1].kcal);
    expect(s.at(-1).kcal).toBeGreaterThan(0);
  });
  test('Keytel gives a positive burn during exercise; zones follow the heart rate', () => {
    expect(keytel(140, prof)).toBeGreaterThan(5);
    expect(keytel(140, { ...prof, sex: 'f' })).toBeGreaterThan(3);
    expect(zoneOf(70)).toBe('静息');
    expect(zoneOf(140)).toBe('有氧');
    expect(zoneOf(200)).toBe('极限');
  });
});

describe('connected heart-rate device', () => {
  test('a reading is used as is, and dropped after 5 s without new ones', () => {
    const M = createMetrics();
    setHeartRate(M, 150, 0);
    expect(updateMetrics(M, { action: 'idle', moving: true, run: false, rate: 1, dt: DT, prof, now: 4000 }).real).toBe(150);
    expect(M.hr).toBe(150);
    expect(updateMetrics(M, { action: 'idle', moving: true, run: false, rate: 1, dt: DT, prof, now: 5001 }).real).toBe(null);
    run(M, 'idle', 60, 5001, { run: false });
    expect(M.hr).toBeLessThan(120);                       // back on the estimate, settling toward rest
  });
  test('anything that is not a positive number disconnects it', () => {
    for (const v of [null, 0, -3, 'x', NaN]) { const M = createMetrics(); setHeartRate(M, 120, 0); setHeartRate(M, v, 10); expect(M.real).toBe(null); }
  });
});

describe('sweat (simulated)', () => {
  test('the total only grows, and grows faster at a higher heart rate', () => {
    const rest = createBio(), hard = createBio();
    let last = 0;
    for (let i = 0; i < 600; i++) {
      updateBio(rest, { hr: 70, musE: 0, w: 65, dt: DT, now: i * 33 });
      updateBio(hard, { hr: 165, musE: 0.8, w: 65, dt: DT, now: i * 33 });
      expect(hard.sweat).toBeGreaterThanOrEqual(last); last = hard.sweat;
    }
    expect(hard.sweat).toBeGreaterThan(rest.sweat * 3);
  });
});

describe('water log', () => {
  const day = '2026-11-4';
  test('malformed or stale logs start fresh; bad entries are dropped', () => {
    expect(sanitizeWater(null, day)).toEqual({ day, log: [] });
    expect(sanitizeWater({ day: '2026-11-3', log: [{ t: 1, ml: 200 }] }, day)).toEqual({ day, log: [] });
    expect(sanitizeWater({ day, log: [{ t: 1, ml: 200 }, { t: 2, ml: -5 }, { t: 'x', ml: 100 }, null, { t: 3, ml: 500, extra: 1 }] }, day))
      .toEqual({ day, log: [{ t: 1, ml: 200 }, { t: 3, ml: 500 }] });
  });
  test('total, net of sweat, and the bottle stays within its outline', () => {
    const w = { day, log: [{ t: 1, ml: 200 }, { t: 2, ml: 500 }] };
    expect(totalOf(w)).toBe(700);
    expect(netOf(700, 120.4)).toBe(580);
    expect(bottleWidth(-100)).toBe(2);
    expect(bottleWidth(GOAL * 2)).toBe(186);
  });
});
