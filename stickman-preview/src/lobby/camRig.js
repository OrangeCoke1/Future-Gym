import { MathUtils, Vector3 } from 'three';

const pivot = new Vector3(0, 1, 0);
const up = new Vector3(0, 1, 0);
const aim = new Vector3(0, 1.05, -1.6);
const homeZ = 5.4;
const stationZ = -1.6;

export function stationPosition(angle) {
  // The life-size equipment and its bays have to fit inside the 8.3 m floor chord.
  return new Vector3(angle / 18, 0, stationZ);
}

export function stationYaw(x) {
  return MathUtils.clamp(Math.atan2(-x, homeZ - stationZ), -0.21, 0.21);
}

/** @param {number} aspect Canvas width divided by height. */
export function roomFraming(aspect) {
  const portrait = aspect < 1;
  const z = portrait ? 9.5 : homeZ;
  const y = portrait ? 2.2 : 1.6;
  const halfWidth = portrait ? 0.41 : 0.70;
  const fov = Math.max(40, MathUtils.radToDeg(2 * Math.atan(halfWidth / aspect)));
  return { z, y, fov };
}

export function stationApproach(angle) {
  const center = stationPosition(angle);
  const yaw = stationYaw(center.x);
  const end = center.clone().add(new Vector3(2.2 * Math.sin(yaw), 1.45, 2.2 * Math.cos(yaw)));
  center.y = 0.92;
  return { end, center };
}

export function frameCapsule(camera, aspect, phase, capsule) {
  const { x, y, z } = capsule.position;
  const facing = capsule.rotation.y;
  const angle = facing + (1 - phase.align) * Math.PI / 6;
  const start = Math.max(5.8, 4.55 / aspect) + (1 - phase.fadeIn) * 0.4;
  const distance = MathUtils.lerp(start, 1.27, phase.dolly);
  camera.aspect = aspect;
  camera.fov = MathUtils.lerp(36, 50, phase.dolly);
  camera.position.set(x + Math.sin(angle) * distance, y + 0.2 * (1 - phase.dolly), z + Math.cos(angle) * distance);
  camera.lookAt(x + Math.sin(facing) * 0.18, y, z + Math.cos(facing) * 0.18);
  camera.updateProjectionMatrix();
}

export function createCamRig(camera) {
  const home = new Vector3(0, 1.6, homeZ);
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

  function apply(dt, pullback = 1, instant = false) {
    const mix = instant ? 1 : 1 - Math.pow(0.92, dt * 60);
    yaw = MathUtils.lerp(yaw, wantYaw, mix);
    pitch = MathUtils.lerp(pitch, wantPitch, mix);
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    camera.position.copy(home).sub(pivot).applyAxisAngle(up, yaw).applyAxisAngle(right, pitch).add(pivot);
    camera.position.z = MathUtils.lerp(stationZ + 1.5, camera.position.z, pullback);
    camera.position.y = MathUtils.lerp(1.45, camera.position.y, pullback);
    target.copy(aim).sub(pivot).applyAxisAngle(up, yaw * 0.36).applyAxisAngle(right, pitch * 0.36).add(pivot);
    camera.lookAt(target);
  }

  function flightTo(station) {
    const from = camera.position.clone(), lookFrom = target.clone();
    const { end, center } = stationApproach(station.angle);
    return progress => {
      camera.position.lerpVectors(from, end, progress);
      camera.lookAt(target.lerpVectors(lookFrom, center, progress));
    };
  }

  return { resize, drag, release, apply, flightTo };
}
