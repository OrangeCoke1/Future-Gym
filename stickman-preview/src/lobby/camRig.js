import { MathUtils, Vector3 } from 'three';

import { BAYS } from './layout.js';

const pivot = new Vector3(0, 1, 0);
const up = new Vector3(0, 1, 0);
const aim = new Vector3(0, 1.29, -3.6);
const homeZ = 5.42;

/** @param {number} aspect Canvas width divided by height. */
export function roomFraming(aspect) {
  const portrait = aspect < 1;
  const z = portrait ? 6.36 : homeZ;
  const y = portrait ? 1.67 : 1.58;
  const halfWidth = portrait ? 0.60 : 0.72;
  const fov = Math.max(46, MathUtils.radToDeg(2 * Math.atan(halfWidth / aspect)));
  return { z, y, fov };
}

export function stationApproach(id) {
  const { position, yaw, focus } = BAYS[id];
  const center = new Vector3(...position);
  const end = center.clone().add(new Vector3(2.2 * Math.sin(yaw), 1.45, 2.2 * Math.cos(yaw)));
  center.y = focus;
  return { end, center };
}

export function createCamRig(camera) {
  const home = new Vector3(0, 1.58, homeZ);
  const target = new Vector3();
  const right = new Vector3();
  let yaw = 0, pitch = 0, wantYaw = 0, wantPitch = 0;

  function resize(aspect) {
    const { z, y, fov } = roomFraming(aspect);
    camera.aspect = aspect;
    camera.fov = fov;
    home.set(0, y, z);
    camera.updateProjectionMatrix();
  }

  function drag(dx, dy) {
    wantYaw = MathUtils.clamp(wantYaw - dx * 0.004, -Math.PI / 10, Math.PI / 10);
    wantPitch = MathUtils.clamp(wantPitch - dy * 0.003, -Math.PI / 36, Math.PI / 36);
  }

  function release() { wantYaw = wantPitch = 0; }

  function frame(yaw, pitch) {
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    camera.position.copy(home).sub(pivot).applyAxisAngle(up, yaw).applyAxisAngle(right, pitch).add(pivot);
    target.copy(aim).sub(pivot).applyAxisAngle(up, yaw * 0.36).applyAxisAngle(right, pitch * 0.36).add(pivot);
    camera.lookAt(target);
  }

  function apply(dt, instant = false) {
    const mix = instant ? 1 : 1 - Math.pow(0.92, dt * 60);
    yaw = MathUtils.lerp(yaw, wantYaw, mix);
    pitch = MathUtils.lerp(pitch, wantPitch, mix);
    frame(yaw, pitch);
  }

  function intro(orbit) { frame(0.32 * (1 - orbit), 0); }

  function flightTo(station) {
    const from = camera.position.clone(), lookFrom = target.clone();
    const { end, center } = stationApproach(station.id);
    return progress => {
      camera.position.lerpVectors(from, end, progress);
      camera.lookAt(target.lerpVectors(lookFrom, center, progress));
    };
  }

  return { resize, drag, release, apply, intro, flightTo };
}
