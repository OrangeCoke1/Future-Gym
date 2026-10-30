import { clamp, TAU } from '../core/math.js';

// Thermal body map (2126 concept, simulated): a front view laid out flat, coloured with an "ironbow" thermal palette.
// Each body part has a resting skin warmth (trunk and head warm, hands and feet cool); working muscles heat up and
// cool down slowly, and everything warms as core temperature rises. Heat is drawn blurred, then masked to the body.
// Layout in a 3 × 5 box, viewer's right = the figure's left (it faces you). zone = index into musAct, -1 = none.
// Proportions are traced from a front-view anatomy reference (about 750 × 1090 px, centre line at x = 375) and
// converted with U(); the silhouette is one smooth outline, the heat parts below sit inside it.
const TS = 5 / 1085, U = (px, py) => [1.5 + (px - 375) * TS, (py - 8) * TS], UR = r => r * TS;
const OUTLINE_R = [                                  // right half, top of the head down to the crotch
  [375, 12], [418, 38], [430, 80], [427, 112], [412, 146], [393, 163], [402, 172], [408, 190], [442, 201], [482, 207],
  [516, 216], [536, 246], [542, 282], [546, 322], [550, 362], [560, 398], [584, 452], [606, 500], [624, 526], [649, 568],
  [646, 606], [632, 640], [612, 634], [598, 600], [586, 562], [572, 528], [552, 486], [522, 428], [500, 386], [486, 336],
  [470, 302], [466, 328], [457, 398], [452, 440], [462, 474], [480, 522], [488, 584], [482, 652], [470, 718], [473, 762],
  [488, 822], [490, 872], [476, 940], [465, 992], [480, 1030], [489, 1064], [471, 1086], [430, 1086], [418, 1060], [420, 1000],
  [415, 930], [411, 850], [407, 762], [409, 720], [400, 640], [392, 580], [381, 548], [375, 549]
];
const OUTLINE = OUTLINE_R.map(([x, y]) => U(x, y)).concat(OUTLINE_R.slice(1, -1).reverse().map(([x, y]) => U(750 - x, y)));
const THERM = [
  { c: U(375, 88), e: [UR(50), UR(76)], base: 0.72 }, { a: U(375, 158), b: U(375, 198), r: UR(30), base: 0.7 },
  { c: U(375, 262), e: [UR(100), UR(64)], base: 0.68, zone: 9 }, { c: U(375, 378), e: [UR(72), UR(72)], base: 0.64, zone: 8 },
  { c: U(375, 492), e: [UR(88), UR(46)], base: 0.6, zone: 8 }
];
for (const [s, n] of [[1, 'L'], [-1, 'R']]) {
  const W = (px, py) => U(375 + s * (px - 375), py), Lz = n === 'L' ? 0 : 1;
  THERM.push(
    { c: W(512, 252), e: [UR(40), UR(46)], base: 0.55, zone: 4 + Lz },                                   // deltoid
    { a: W(528, 288), b: W(548, 392), r: UR(30), base: 0.52, zone: 4 + Lz }, { a: W(552, 400), b: W(612, 516), r: UR(26), base: 0.45, zone: 6 + Lz },
    { c: W(622, 582), e: [UR(26), UR(44)], base: 0.32 },                                                  // hand
    { a: W(438, 540), b: W(444, 716), r: UR(50), base: 0.5, zone: Lz }, { a: W(444, 770), b: W(447, 960), r: UR(32), base: 0.44, zone: 2 + Lz },
    { c: W(452, 1046), e: [UR(26), UR(36)], base: 0.28 });                                                // foot
}
function outlinePath(x, P) {          // closed Catmull–Rom curve through the outline points
  const pts = OUTLINE.map(P), n = pts.length;
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    x.bezierCurveTo(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6, p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6, p2[0], p2[1]);
  }
  x.closePath();
}
const IRON = [[0, [18, 10, 42]], [0.2, [59, 28, 140]], [0.4, [176, 35, 122]], [0.6, [240, 88, 42]], [0.8, [251, 197, 49]], [1, [255, 251, 224]]];
const ironLUT = new Uint8ClampedArray(256 * 3);
for (let i = 0; i < 256; i++) {
  const v = i / 255; let j = 1; while (j < IRON.length - 1 && IRON[j][0] < v) j++;
  const [v0, c0] = IRON[j - 1], [v1, c1] = IRON[j], f = (v - v0) / (v1 - v0);
  for (let c = 0; c < 3; c++) ironLUT[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * f;
}

/** @typedef {{ heat: number[], zone: number[], heatCv: HTMLCanvasElement, maskCv: HTMLCanvasElement }} ThermState */
/** @returns {ThermState} */
export const createTherm = () => ({ heat: THERM.map(p => p.base), zone: new Array(10).fill(0), heatCv: document.createElement('canvas'), maskCv: document.createElement('canvas') });

/**
 * one frame: working muscles heat up (and the heat lingers after the effort), everything warms with core temperature
 * @param {ThermState} st @param {{ musAct: number[], temp: number, dt: number }} o  musAct = per-zone muscle effort, temp = core °C
 */
export function updateTherm(st, { musAct, temp, dt }) {
  const thermHeat = st.heat, zoneHeat = st.zone;
  const warm = clamp((temp - 36.7) / 1.6, 0, 1);
  for (let z = 0; z < 10; z++) zoneHeat[z] += (musAct[z] - zoneHeat[z]) * (1 - Math.exp(-dt / 4));   // muscle heat lingers after the effort
  THERM.forEach((p, i) => {
    const core = p.base >= 0.6 ? 0.25 : 0.15, target = Math.min(1, p.base + core * warm + (p.zone >= 0 ? 0.42 * zoneHeat[p.zone] : 0));
    thermHeat[i] += (target - thermHeat[i]) * (1 - Math.exp(-dt / 1.5));
  });
}

/** @param {import("./chart.js").Chart} ch @param {ThermState} st */
export function drawTherm(ch, st) {
  const { heatCv, maskCv, heat: thermHeat } = st;
  const { g, w, h } = ch;
  if (w < 20 || h < 20) return;
  const u = Math.min(w / 3, h / 5), ox = (w - 3 * u) / 2, oy = (h - 5 * u) / 2, P = q => [ox + q[0] * u, oy + q[1] * u];
  for (const cv of [heatCv, maskCv]) { cv.width = w; cv.height = h; }
  const shape = (x, p, grow) => {
    x.beginPath();
    if (p.c) { const c = P(p.c); x.ellipse(c[0], c[1], (p.e[0] + grow) * u, (p.e[1] + grow) * u, 0, 0, TAU); }
    else { const a = P(p.a), b = P(p.b); x.lineCap = 'round'; x.lineWidth = (p.r + grow) * 2 * u; x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); return; }
    x.fill();
  };
  const hg = heatCv.getContext('2d', { willReadFrequently: true }), mg = maskCv.getContext('2d', { willReadFrequently: true });
  hg.fillStyle = '#000'; hg.fillRect(0, 0, w, h);
  hg.filter = `blur(${Math.max(1, 0.1 * u)}px)`;
  hg.fillStyle = 'rgb(84,84,84)'; outlinePath(hg, P); hg.fill();     // cool skin baseline so gaps between parts are not black
  hg.globalCompositeOperation = 'lighten';
  THERM.forEach((p, i) => { const v = Math.round(thermHeat[i] * 255); hg.fillStyle = hg.strokeStyle = `rgb(${v},${v},${v})`; shape(hg, p, 0.05); });
  mg.clearRect(0, 0, w, h); mg.filter = `blur(${Math.max(0.6, 0.035 * u)}px)`; mg.fillStyle = mg.strokeStyle = '#fff';
  outlinePath(mg, P); mg.fill();
  const H = hg.getImageData(0, 0, w, h).data, Mk = mg.getImageData(0, 0, w, h).data, out = g.createImageData(w, h), O = out.data;
  for (let i = 0; i < O.length; i += 4) {
    const a = Mk[i + 3]; if (!a) continue;
    const v = clamp(H[i] + (Math.random() - 0.5) * 6, 0, 255) | 0;      // a little sensor grain
    O[i] = ironLUT[v * 3]; O[i + 1] = ironLUT[v * 3 + 1]; O[i + 2] = ironLUT[v * 3 + 2]; O[i + 3] = a;
  }
  g.putImageData(out, 0, 0);
}
