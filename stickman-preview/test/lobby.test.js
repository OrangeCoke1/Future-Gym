import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { ACT } from '../src/core/actions.js';
import { STATIONS } from '../src/lobby/stations.js';
import { FLIGHT_END, INTRO_END, flightAt, phaseAt, stationRevealAt } from '../src/lobby/timeline.js';
import { createCamRig, frameCapsule, stationApproach, stationPosition } from '../src/lobby/camRig.js';

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
  it('moves the doors outward before sliding and cuts at full flash opacity', () => {
    expect(phaseAt(1.65).pop).toBeGreaterThan(0);
    expect(phaseAt(1.65).lid).toBe(0);
    expect(phaseAt(1.9).pop).toBe(1);
    expect(phaseAt(1.9).lid).toBeGreaterThan(0);
    expect(phaseAt(1.9).lid).toBeLessThan(1);
    expect(phaseAt(2.4).lid).toBe(1);
    expect(phaseAt(3.49).room).toBe(false);
    expect(phaseAt(3.5)).toMatchObject({ flash: 1, room: true, pullback: 0, dolly: 1 });
    expect(phaseAt(3.7).flash).toBe(0);
  });

  it('advances the clamped channels in order and staggers the station lights', () => {
    const channels = ['fadeIn', 'seam', 'pop', 'lid', 'burst', 'align', 'dolly', 'pullback', 'reveal'];
    const first = phaseAt(0), last = phaseAt(INTRO_END);
    expect(INTRO_END).toBe(4.6);
    expect(phaseAt(-1)).toEqual(first);
    expect(phaseAt(INTRO_END - 0.001).ready).toBe(false);
    expect(last.ready).toBe(true);
    expect(phaseAt(60)).toEqual(last);
    expect(channels.every(key => first[key] === 0 && last[key] === 1)).toBe(true);

    let previous = first;
    for (let i = 1; i <= 46; i++) {
      const next = phaseAt(i / 10);
      for (const key of channels) expect(next[key]).toBeGreaterThanOrEqual(previous[key]);
      for (const value of Object.values(next).filter(v => typeof v === 'number')) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      previous = next;
    }
    expect(stationRevealAt(3.8, 0)).toBeGreaterThan(stationRevealAt(3.8, 1));
    expect(stationRevealAt(3.8, 2)).toBe(0);
    expect(stationRevealAt(INTRO_END, 3)).toBe(1);
  });
});

describe('lobby camera', () => {
  it('keeps the whole row of station centers and labels in desktop and portrait frames', () => {
    for (const aspect of [16 / 9, 1440 / 900, 3 / 4, 390 / 844, 320 / 960]) {
      const camera = new PerspectiveCamera();
      const rig = createCamRig(camera);
      rig.resize(aspect);
      rig.apply(1);
      camera.updateMatrixWorld();
      for (const station of STATIONS) {
        const center = stationPosition(station.angle);
        for (const y of [0, 2.73]) {
          const point = center.clone().setY(y).project(camera);
          expect(Math.abs(point.x)).toBeLessThan(0.86);
          expect(Math.abs(point.y)).toBeLessThan(0.76);
        }
      }
    }
  });

  it('lines up with the opening before the white cut', () => {
    const camera = new PerspectiveCamera();
    const capsule = { position: new Vector3(0, 1.32, 0), rotation: { y: 0.175 } };
    frameCapsule(camera, 1.6, phaseAt(3.5), capsule);
    expect(camera.fov).toBe(50);
    expect(camera.position.distanceTo(capsule.position)).toBeCloseTo(1.27);
    expect(Math.atan2(camera.position.x, camera.position.z)).toBeCloseTo(capsule.rotation.y);
  });

  it('lands 2.2 m in front of the chosen bay and fades only at the end', () => {
    for (const station of STATIONS) {
      const { end, center } = stationApproach(station.angle);
      expect(Math.hypot(end.x - center.x, end.z - center.z)).toBeCloseTo(2.2);
      expect(end.y).toBe(1.45);
    }
    expect(flightAt(0)).toEqual({ position: 0, fade: 0 });
    expect(flightAt(0.55).fade).toBe(0);
    expect(flightAt(0.75).fade).toBeGreaterThan(0);
    expect(flightAt(FLIGHT_END)).toEqual({ position: 1, fade: 1 });
  });
});
