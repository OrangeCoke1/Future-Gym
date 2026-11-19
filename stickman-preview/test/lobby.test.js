import { describe, expect, it } from 'vitest';
import { ACT } from '../src/core/actions.js';
import { STATIONS } from '../src/lobby/stations.js';

describe('lobby stations', () => {
  it('uses unique IDs and real training actions', () => {
    expect(new Set(STATIONS.map(s => s.id)).size).toBe(4);
    for (const { act, acts } of STATIONS) {
      expect(acts).toContain(act);
      expect(acts.every(key => Object.hasOwn(ACT, key))).toBe(true);
    }
  });
});
