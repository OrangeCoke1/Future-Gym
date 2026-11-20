import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Vector3 } from 'three';
import { ACT } from '../src/core/actions.js';
import { STATIONS } from '../src/lobby/stations.js';
import { FLIGHT_END, INTRO_END, flightAt, phaseAt } from '../src/lobby/timeline.js';
import { createCamRig, stationApproach } from '../src/lobby/camRig.js';
import { samplePhotoDepth } from '../src/lobby/photoCapture.js';
import { BAYS, WALL_PLAQUES, WALL_PLAQUE_X, WALL_PLAQUE_Z } from '../src/lobby/layout.js';

describe('lobby stations', () => {
  it('uses unique IDs and real training actions', () => {
    const ids = new Set(STATIONS.map(s => s.id));
    expect(ids.size).toBe(4);
    expect(Object.keys(BAYS).sort()).toEqual([...ids].sort());
    expect(WALL_PLAQUES.map(({ id }) => id).sort()).toEqual([...ids].sort());
    for (const { act, acts } of STATIONS) {
      expect(acts).toContain(act);
      expect(acts.every(key => Object.hasOwn(ACT, key))).toBe(true);
    }
  });
});

describe('photo intro timeline', () => {
  it('settles the photo, overlaps the dissolve with flight, then reveals the room', () => {
    expect(phaseAt(0.4).toss).toBeGreaterThan(0);
    expect(phaseAt(0.84).rebound).toBeGreaterThan(0);
    expect(phaseAt(1.16).rebound).toBeLessThan(0);
    const settled = phaseAt(1.3);
    expect(settled).toMatchObject({ toss: 1, dissolve: 0, orbit: 0, room: 0 });
    expect(Math.abs(settled.rebound)).toBe(0);
    expect(phaseAt(2).dissolve).toBeGreaterThan(0);
    expect(phaseAt(2).orbit).toBe(0);
    expect(phaseAt(2.3)).toMatchObject({ dissolve: 1, room: 0 });
    expect(phaseAt(2.3).orbit).toBeGreaterThan(0);
    expect(phaseAt(4)).toMatchObject({ orbit: 1, room: 0, ready: false });
    expect(phaseAt(4.4).room).toBeCloseTo(0.5);
  });

  it('clamps the timeline and signals ready at the end of the handoff', () => {
    const channels = ['toss', 'glint', 'dissolve', 'orbit', 'room'];
    const first = phaseAt(0), last = phaseAt(INTRO_END);
    expect(INTRO_END).toBe(4.8);
    expect(phaseAt(-1)).toEqual(first);
    expect(phaseAt(INTRO_END - 0.001).ready).toBe(false);
    expect(last.ready).toBe(true);
    expect(phaseAt(60)).toEqual(last);
    expect(channels.every(key => first[key] === 0 && last[key] === 1)).toBe(true);

    let previous = first;
    for (let i = 1; i <= 48; i++) {
      const next = phaseAt(i / 10);
      for (const key of channels) {
        expect(next[key]).toBeGreaterThanOrEqual(previous[key]);
        expect(next[key]).toBeLessThanOrEqual(1);
      }
      previous = next;
    }
  });
});

describe('photo depth samples', () => {
  it('only samples geometry, unprojects pixel centers, and orders far surfaces first', () => {
    const camera = new PerspectiveCamera(50, 1.5, 0.1, 30);
    camera.position.set(2, 1, 5);
    camera.lookAt(0, 0, -1);
    camera.updateMatrixWorld();
    const packed = new Uint8Array(3 * 2 * 4).fill(255);
    const depth = new DataView(packed.buffer);
    depth.setUint32(0, 0xe0000000, true);
    depth.setUint32(5 * 4, 0xf0000000, true);

    const { positions, uvs } = samplePhotoDepth(packed, 3, 2, camera, true);
    expect(positions).toHaveLength(6);
    expect(uvs[0]).toBeCloseTo(5 / 6);
    expect(uvs[1]).toBe(0.75);
    expect(uvs[2]).toBeCloseTo(1 / 6);
    expect(uvs[3]).toBe(0.25);
    for (const [i, z] of [0.875, 0.75].entries()) {
      const point = new Vector3().fromArray(positions, i * 3).project(camera);
      expect(point.x).toBeCloseTo(uvs[i * 2] * 2 - 1);
      expect(point.y).toBeCloseTo(uvs[i * 2 + 1] * 2 - 1);
      expect(point.z).toBeCloseTo(z);
    }
  });

  it('limits the particle counts for each quality level', () => {
    const width = 400, height = 200;
    const camera = new PerspectiveCamera(45, width / height);
    const packed = new Uint8Array(width * height * 4).fill(128);
    expect(samplePhotoDepth(packed, width, height, camera, true).positions.length / 3).toBe(70000);
    expect(samplePhotoDepth(packed, width, height, camera, false).positions.length / 3).toBe(35000);
  });
});

describe('lobby camera', () => {
  it('keeps the left cabinet, rear treadmill, right rack and foreground mat in frame', () => {
    const up = new Vector3(0, 1, 0);
    for (const aspect of [16 / 9, 1440 / 900, 3 / 4, 390 / 844, 320 / 960]) {
      const camera = new PerspectiveCamera();
      const rig = createCamRig(camera);
      rig.resize(aspect);
      rig.apply(1);
      camera.updateMatrixWorld();
      const points = {};
      for (const [id, bay] of Object.entries(BAYS)) {
        const origin = new Vector3(...bay.position);
        const label = new Vector3(...bay.anchor).multiplyScalar(bay.scale ?? 1)
          .applyAxisAngle(up, bay.yaw).add(origin).project(camera);
        points[id] = origin.project(camera);
        expect(Math.abs(label.x)).toBeLessThan(0.90);
        expect(Math.abs(label.y)).toBeLessThan(0.94);
      }
      expect(points.dumbbell.x).toBeLessThan(points.cardio.x);
      expect(points.squat.x).toBeGreaterThan(points.mat.x);
      expect(points.mat.y).toBeLessThan(points.cardio.y);
      for (const { y } of WALL_PLAQUES) {
        const plaque = new Vector3(WALL_PLAQUE_X, y, WALL_PLAQUE_Z).project(camera);
        expect(plaque.x).toBeGreaterThan(points.squat.x);
        expect(plaque.x).toBeLessThan(1);
        expect(Math.abs(plaque.y)).toBeLessThan(1);
      }
    }
  });

  it('orbits from the side to exactly the home view before the handoff', () => {
    const camera = new PerspectiveCamera();
    const rig = createCamRig(camera);
    rig.resize(1.6);
    rig.apply(0);
    const home = camera.position.clone(), orientation = camera.quaternion.clone();
    rig.intro(phaseAt(2).orbit);
    const side = camera.position.x;
    expect(side).toBeGreaterThan(1);
    rig.intro(phaseAt(3).orbit);
    expect(camera.position.x).toBeGreaterThan(0);
    expect(camera.position.x).toBeLessThan(side);
    rig.intro(phaseAt(4).orbit);
    expect(camera.position.distanceTo(home)).toBeCloseTo(0);
    expect(camera.quaternion.angleTo(orientation)).toBeCloseTo(0);
  });

  it('lands 2.2 m in front of the chosen bay and fades only at the end', () => {
    for (const station of STATIONS) {
      const { end, center } = stationApproach(station.id);
      expect(Math.hypot(end.x - center.x, end.z - center.z)).toBeCloseTo(2.2);
      expect(end.y).toBe(1.45);
    }
    expect(flightAt(0)).toEqual({ position: 0, fade: 0 });
    expect(flightAt(0.55).fade).toBe(0);
    expect(flightAt(0.75).fade).toBeGreaterThan(0);
    expect(flightAt(FLIGHT_END)).toEqual({ position: 1, fade: 1 });
  });
});
