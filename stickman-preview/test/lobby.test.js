import { describe, expect, it } from 'vitest';
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { ACT } from '../src/core/actions.js';
import { STATIONS } from '../src/lobby/stations.js';
import { FLIGHT_END, HATCH_CROSS, INTRO_END, SPLAT_LAND, flightAt, phaseAt } from '../src/lobby/timeline.js';
import { createCamRig, stationApproach } from '../src/lobby/camRig.js';
import { buildCity, CITY_FAR } from '../src/lobby/cityScene.js';
import { samplePhotoDepth } from '../src/lobby/photoCapture.js';
import { roomPixelRatio } from '../src/lobby/post.js';
import { BAYS, HATCH, ROOM, WALL_PLAQUES, WALL_PLAQUE_X, WALL_PLAQUE_Z } from '../src/lobby/layout.js';

describe('lobby render resolution', () => {
  it('uses 1.5x on a Retina viewport and honours the display and pixel budget', () => {
    expect(roomPixelRatio(1325, 734, 2)).toBe(1.5);
    expect(roomPixelRatio(1325, 734, 1)).toBe(1);
    const pixels = 2560 * 1440;
    expect(pixels * roomPixelRatio(2560, 1440, 2) ** 2).toBeCloseTo(2_250_000);
  });

  it('can fall back to the smaller render target while keeping HDR', () => {
    const ratio = roomPixelRatio(1325, 734, 2, true);
    expect(ratio).toBeLessThan(roomPixelRatio(1325, 734, 2));
    expect(1325 * 734 * ratio ** 2).toBeCloseTo(1_280_000);
  });
});

describe('exterior city', () => {
  it('moves the track across the view faster than the far skyline during a sideways camera move', () => {
    const city = buildCity(false);
    city.updateMatrixWorld(true);
    expect(new Box3().setFromObject(city.getObjectByName('river')).max.z).toBeLessThan(ROOM.back);
    const track = new Box3().setFromObject(city.getObjectByName('elevated transit')).getCenter(new Vector3());
    const skyline = new Box3().setFromObject(city.getObjectByName('distant skyline')).getCenter(new Vector3());
    const camera = new PerspectiveCamera(48, 1.6, 0.05, CITY_FAR);
    camera.position.set(-0.85, 1.58, 5.42);
    camera.updateMatrixWorld();
    const baseline = [track, skyline].map(point => point.clone().project(camera).x);
    camera.position.x = 0.85;
    camera.updateMatrixWorld();
    const [nearShift, farShift] = [track, skyline].map((point, i) => baseline[i] - point.clone().project(camera).x);
    expect(farShift).toBeGreaterThan(0);
    expect(nearShift).toBeGreaterThan(2.5 * farShift);
  });
});

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

describe('capsule to particle timeline', () => {
  it('unlocks before sliding the hatch and assembles the room after crossing', () => {
    expect(phaseAt(0.8).unlock).toBeGreaterThan(0);
    expect(phaseAt(0.8)).toMatchObject({ doors: 0, entered: false });
    expect(phaseAt(1.7).doors).toBeGreaterThan(0);
    expect(phaseAt(1.7)).toMatchObject({ unlock: 1, approach: 0, entered: false });
    expect(phaseAt(HATCH_CROSS - 0.01)).toMatchObject({ doors: 1, entered: false, room: 0 });
    expect(phaseAt(HATCH_CROSS)).toMatchObject({ approach: 1, entered: true, advance: 0, room: 0 });
    expect(phaseAt(HATCH_CROSS + 0.3)).toMatchObject({ doorwayFade: 1, entered: true, room: 0 });
    expect(phaseAt(SPLAT_LAND)).toMatchObject({ advance: 1, room: 0, ready: false });
    expect(phaseAt((SPLAT_LAND + INTRO_END) / 2).room).toBeGreaterThan(0);
  });

  it('clamps the timeline and signals ready at the end of the handoff', () => {
    const channels = ['unlock', 'doors', 'approach', 'doorwayFade', 'advance', 'room'];
    const first = phaseAt(0), last = phaseAt(INTRO_END);
    expect(phaseAt(-1)).toEqual(first);
    expect(phaseAt(INTRO_END - 0.001).ready).toBe(false);
    expect(last.ready).toBe(true);
    expect(phaseAt(60)).toEqual(last);
    expect(channels.every(key => first[key] === 0 && last[key] === 1)).toBe(true);

    let previous = first;
    for (let i = 1; i <= 55; i++) {
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

  it('moves through the physical hatch and arrives at the exact home framing', () => {
    for (const aspect of [1.6, 390 / 844]) {
      const camera = new PerspectiveCamera();
      const rig = createCamRig(camera);
      rig.resize(aspect);
      rig.apply(0);
      const home = camera.position.clone(), orientation = camera.quaternion.clone(), fov = camera.fov;
      rig.intro(phaseAt(0));
      expect(camera.position.z).toBeGreaterThan(HATCH.z + 3);
      expect(camera.position.x).toBeGreaterThan(1);
      rig.intro(phaseAt(HATCH_CROSS - 0.001));
      const threshold = camera.position.clone();
      rig.intro(phaseAt(HATCH_CROSS));
      expect(camera.position.z).toBeLessThan(HATCH.z);
      expect(camera.position.distanceTo(threshold)).toBeLessThan(0.02);
      expect(Math.abs(camera.position.x)).toBeLessThan(HATCH.radius);
      rig.intro(phaseAt((HATCH_CROSS + SPLAT_LAND) / 2));
      expect(camera.position.x).toBeLessThan(-0.5);
      rig.intro(phaseAt(SPLAT_LAND));
      expect(camera.position.distanceTo(home)).toBeCloseTo(0);
      expect(camera.quaternion.angleTo(orientation)).toBeCloseTo(0);
      expect(camera.fov).toBe(fov);
    }
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
