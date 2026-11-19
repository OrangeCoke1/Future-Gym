import { MathUtils, Vector3 } from 'three';

const pivot = new Vector3(0, 1, 0);
const up = new Vector3(0, 1, 0);
const aim = new Vector3(0, 1.1, -2.7);

export function stationPosition(angle) {
  const radians = MathUtils.degToRad(angle);
  return new Vector3(4 * Math.sin(radians), 0, -4 * Math.cos(radians));
}

/** @param {number} aspect Canvas width divided by height. */
export function roomFraming(aspect) {
  const portrait = aspect < 1;
  const z = portrait ? 8.5 : 7.2;
  const fov = Math.max(44, MathUtils.radToDeg(2 * Math.atan(0.46 / aspect)));
  return { z, fov };
}

export function frameCapsule(camera, aspect, dolly) {
  camera.aspect = aspect;
  camera.fov = 36;
  const distance = Math.max(5.6, 2.1 / aspect);
  camera.position.set(0.12 * (1 - dolly), 1.5 + 0.48 * dolly, MathUtils.lerp(distance, -0.9, dolly));
  camera.lookAt(0, 1.5 + 0.32 * dolly, -1.2);
  camera.updateProjectionMatrix();
}

export function createCamRig(camera) {
  const home = new Vector3(0, 3.6, 7.2);
  const target = new Vector3();
  const right = new Vector3();
  let yaw = 0, pitch = 0, wantYaw = 0, wantPitch = 0;

  function resize(aspect) {
    const { z, fov } = roomFraming(aspect);
    camera.aspect = aspect;
    camera.fov = fov;
    home.z = z;
    camera.updateProjectionMatrix();
  }

  function drag(dx, dy) {
    wantYaw = MathUtils.clamp(wantYaw - dx * 0.004, -Math.PI / 6, Math.PI / 6);
    wantPitch = MathUtils.clamp(wantPitch - dy * 0.003, -Math.PI / 22.5, Math.PI / 22.5);
  }

  function release() { wantYaw = wantPitch = 0; }

  function apply(dt, approach = 0) {
    const mix = 1 - Math.pow(0.92, dt * 60);
    yaw = MathUtils.lerp(yaw, wantYaw, mix);
    pitch = MathUtils.lerp(pitch, wantPitch, mix);
    right.set(Math.cos(yaw), 0, -Math.sin(yaw));
    camera.position.copy(home).sub(pivot).applyAxisAngle(up, yaw).applyAxisAngle(right, pitch).add(pivot);
    camera.position.z += approach;
    target.copy(aim).sub(pivot).applyAxisAngle(up, yaw * 0.36).applyAxisAngle(right, pitch * 0.36).add(pivot);
    camera.lookAt(target);
  }

  return { resize, drag, release, apply };
}
