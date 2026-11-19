import { describe, expect, it } from 'vitest';
import { ACT } from '../src/core/actions.js';
import { STATIONS } from '../src/lobby/stations.js';
import { INTRO_END, phaseAt, lidAngleAt, stationRevealAt } from '../src/lobby/timeline.js';

describe('lobby stations', () => {
  it('uses unique IDs and real training actions', () => {
    expect(new Set(STATIONS.map(s => s.id)).size).toBe(4);
    for (const { act, acts } of STATIONS) {
      expect(acts).toContain(act);
      expect(acts.every(key => Object.hasOwn(ACT, key))).toBe(true);
    }
  });
});

describe('capsule timeline', () => {
  it('clamps all channels and opens the lobby at 4.3 seconds', () => {
    expect(phaseAt(-1)).toEqual({ seam: 0, lid: 0, burst: 0, dolly: 0, reveal: 0, ready: false });
    expect(phaseAt(INTRO_END - 0.001).ready).toBe(false);
    expect(phaseAt(INTRO_END)).toEqual({ seam: 1, lid: 1, burst: 1, dolly: 1, reveal: 1, ready: true });
    expect(phaseAt(60)).toEqual(phaseAt(INTRO_END));
    expect(lidAngleAt(2.3)).toBeCloseTo(-110 * Math.PI / 180);
  });

  it('advances the clamped channels in order and staggers the stations', () => {
    const channels = ['seam', 'burst', 'dolly', 'reveal'];
    let previous = phaseAt(0);
    for (let i = 1; i < 44; i++) {
      const next = phaseAt(i / 10);
      for (const key of channels) expect(next[key]).toBeGreaterThanOrEqual(previous[key]);
      for (const value of Object.values(next).filter(v => typeof v === 'number')) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      previous = next;
    }
    expect(stationRevealAt(3.37, 0)).toBeGreaterThan(stationRevealAt(3.37, 1));
    expect(stationRevealAt(3.37, 2)).toBe(0);
    expect(stationRevealAt(INTRO_END, 3)).toBe(1);
  });
});
