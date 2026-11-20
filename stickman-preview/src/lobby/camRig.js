import { MathUtils, Vector3 } from 'three';

import { BAYS, HATCH } from './layout.js';

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
  let yaw = 0, pitch = 0, wantYaw = 0, wantPitch = 0, homeFov = 46;

  function resize(aspect) {
    const { z, y, fov } = roomFraming(aspect);
    camera.aspect = aspect;
    homeFov = fov;
    home.set(0, y, z);
    lens(homeFov);
  }

  function lens(fov) {
    camera.fov = fov;
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
    if (camera.fov !== homeFov) lens(homeFov);
    frame(yaw, pitch);
  }

  function intro({ approach, entered, advance, orbit }) {
    if (entered) {
      camera.position.set(-0.93 * orbit, MathUtils.lerp(HATCH.y, home.y, advance),
        MathUtils.lerp(HATCH.z - 0.065, home.z, advance));
      camera.lookAt(0.18 * orbit, MathUtils.lerp(HATCH.y, aim.y, advance), aim.z);
      lens(homeFov);
      return;
    }
    const startFov = MathUtils.clamp(homeFov - 11, 36, 61);
    const startDistance = Math.max(4.9, 1.91 / (Math.tan(MathUtils.degToRad(startFov * 0.5)) * camera.aspect));
    const distance = MathUtils.lerp(startDistance, -0.065, approach);
    const yaw = 0.57 * (1 - approach);
    camera.position.set(Math.sin(yaw) * distance, HATCH.y + 0.54 * (1 - approach),
      HATCH.z + Math.cos(yaw) * distance);
    const doorAim = MathUtils.lerp(HATCH.z - 1.48, HATCH.z - 0.04, MathUtils.smoothstep(approach, 0, 0.59));
    camera.lookAt(0, HATCH.y, MathUtils.lerp(doorAim, aim.z, MathUtils.smoothstep(approach, 0.72, 1)));
    lens(MathUtils.lerp(startFov, homeFov, approach));
  }

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
