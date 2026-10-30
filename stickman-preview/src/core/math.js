// Plain {x, y, z} vector helpers shared by the skeleton, the camera retargeting, the simulations and the charts.

/** @typedef {{ x: number, y: number, z: number }} Vec3 */

export const V = (x, y, z) => ({ x, y, z });
export const add = (a, b) => V(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a, b) => V(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a, k) => V(a.x * k, a.y * k, a.z * k);
export const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a, b) => V(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const len = a => Math.hypot(a.x, a.y, a.z);
export const nrm = a => { const l = len(a) || 1; return mul(a, 1 / l); };
export const rotX = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return V(v.x, v.y * c - v.z * s, v.y * s + v.z * c); };
export const rotY = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return V(v.x * c + v.z * s, v.y, -v.x * s + v.z * c); };
export const rotZ = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return V(v.x * c - v.y * s, v.x * s + v.y * c, v.z); };
export const lerp = (a, b, k) => a + (b - a) * k;
export const sine = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
export const easeIO = k => k < .5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const TAU = Math.PI * 2;
export const UP = V(0, 1, 0), DOWN = V(0, -1, 0), FWD = V(0, 0, 1), BACK = V(0, 0, -1);
export const C = { ink: '#1D231E', ivory: '#F1F0E2', acc: '#E0704A', off: 'rgba(241,240,226,.28)', inkOff: 'rgba(29,35,30,.3)' };
