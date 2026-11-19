import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { ACT } from '../src/core/actions.js';
import { STATIONS } from '../src/lobby/stations.js';
import { FLIGHT_END, INTRO_END, flightAt, phaseAt, lidAngleAt, stationRevealAt } from '../src/lobby/timeline.js';
import { createCamRig, stationApproach, stationPosition } from '../src/lobby/camRig.js';

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

describe('lobby camera', () => {
  it('keeps all stations in frame at desktop and portrait aspect ratios', () => {
    for (const aspect of [16 / 9, 3 / 4, 390 / 844, 320 / 960]) {
      const camera = new PerspectiveCamera();
      const rig = createCamRig(camera);
      rig.resize(aspect);
      rig.apply(1);
      camera.updateMatrixWorld();
      for (const station of STATIONS) {
        const point = stationPosition(station.angle).project(camera);
        expect(Math.abs(point.x)).toBeLessThan(0.84);
        expect(Math.abs(point.y)).toBeLessThan(0.76);
      }
    }
  });

  it('lands 1.6 m in front of the chosen station and fades only at the end', () => {
    for (const station of STATIONS) {
      const { end, center } = stationApproach(station.angle);
      expect(Math.hypot(end.x - center.x, end.z - center.z)).toBeCloseTo(1.6);
      expect(end.y).toBe(1.3);
    }
    expect(flightAt(0)).toEqual({ position: 0, fade: 0 });
    expect(flightAt(0.55).fade).toBe(0);
    expect(flightAt(0.75).fade).toBeGreaterThan(0);
    expect(flightAt(FLIGHT_END)).toEqual({ position: 1, fade: 1 });
  });
});
