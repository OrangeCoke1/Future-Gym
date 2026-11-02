// Camera-following benchmark: replays extracted poses (tools/pose-extract.mjs) through the app's own following code
// (camIngest → camPredict, src/pose/camera.js) on a simulated clock, and measures how far the figure trails the person.
//
// Clock model: a frame captured at t reaches the landmarker at t + camDelay (camera, browser) and its result is ready
// camDelay + inferDelay after capture. The screen renders every 1/60 s from the latest result, carried forward by
// camPredict. "Truth" is the person's pose at the render moment: the raw landmarks, smoothed without any delay
// (centred Gaussian), in the same 2D / 3D fused space. Signals compared: knee, hip and elbow angles (°, both sides).
//
// Per signal: lag (ms, the shift of the truth that best matches the figure), err (RMS °, no shift), jitter (RMS
// frame-to-frame acceleration of the figure while the person holds still, °), over (worst overshoot at turnarounds, °).
//
// Usage (in stickman-preview/):
//   node tools/follow-bench.mjs tools/poses/*.json [--cam 50] [--infer 35] [--minCut 1.5] [--beta 6] [--lead 60] [--sweep] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { createCamPose, camIngest, camPredict, fuse2d } from '../src/pose/camera.js';
import { CAM_TUNE_DEFAULT } from '../src/pose/camTune.js';
import { angle3 } from '../src/core/skeleton.js';
import { V } from '../src/core/math.js';

const RENDER_DT = 1000 / 60;
/** angle signals: name → [a, b, c] joint names (angle at b) */
const SIGNALS = {
  knee: [['hipL', 'knL', 'anL'], ['hipR', 'knR', 'anR']],
  hip: [['shL', 'hipL', 'knL'], ['shR', 'hipR', 'knR']],
  elbow: [['shL', 'elL', 'wrL'], ['shR', 'elR', 'wrR']]
};
const LMI = { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27 };

/** parse args: files + options */
export function parseArgs(argv) {
  const o = { files: [], cam: 50, infer: 35, minCut: CAM_TUNE_DEFAULT.minCut, beta: CAM_TUNE_DEFAULT.beta, lead: CAM_TUNE_DEFAULT.lead, sweep: false, json: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--sweep') o.sweep = true;
    else if (a === '--json') o.json = argv[++i];
    else if (a.startsWith('--') && a.slice(2) in o) o[a.slice(2)] = Number(argv[++i]);
    else o.files.push(a);
  }
  return o;
}

const unflat = a => {
  if (!a) return null;
  const out = [];
  for (let i = 0; i < a.length; i += 4) out.push({ x: a[i], y: a[i + 1], z: a[i + 2], visibility: a[i + 3] });
  return out;
};

/** a recording: frames with MediaPipe-shaped results */
export function loadRec(file) {
  const r = JSON.parse(readFileSync(file, 'utf8'));
  const frames = r.frames.map(f => ({ t: f.t, res: f.wl ? { landmarks: [unflat(f.lm)], worldLandmarks: [unflat(f.wl)] } : { landmarks: [], worldLandmarks: [] } }));
  return { name: r.name || basename(file), aspect: r.w > 0 && r.h > 0 ? r.w / r.h : 4 / 3, frames };
}

/** truth joints per frame: fused like camIngest (no mirror), then a centred Gaussian over time; null = not seen */
function truthJoints(rec) {
  const cam = createCamPose(); cam.aspect = rec.aspect;
  const raw = rec.frames.map(f => {
    const w = f.res.worldLandmarks[0];
    if (!w) return null;
    const p = fuse2d(cam, w, f.res.landmarks[0] || null), J = {};
    for (const k in LMI) for (const s of ['L', 'R']) {
      const q = p[LMI[k] + (s === 'R' ? 1 : 0)];
      J[k + s] = { v: V(q.x, -q.y, -q.z), vis: q.visibility ?? 1 };
    }
    return J;
  });
  const sig = 1.5, K = [-3, -2, -1, 0, 1, 2, 3].map(d => [d, Math.exp(-d * d / (2 * sig * sig))]);
  return raw.map((J, i) => {
    if (!J) return null;
    const out = {};
    for (const k in J) {
      let x = 0, y = 0, z = 0, w = 0;
      for (const [d, g] of K) { const o = raw[i + d] && raw[i + d][k]; if (!o || o.vis < 0.5) continue; x += o.v.x * g; y += o.v.y * g; z += o.v.z * g; w += g; }
      out[k] = w > 0 ? { v: V(x / w, y / w, z / w), vis: J[k].vis } : J[k];
    }
    return out;
  });
}

/** angle signals of one joint set (null where a joint is unsure) */
function anglesOf(J, visOf) {
  const out = {};
  for (const s in SIGNALS) out[s] = SIGNALS[s].map(tri => (tri.every(k => visOf(k) >= 0.6) ? angle3(...tri.map(k => J(k))) : null));
  return out;
}

/** the figure's signals at each render tick, and the truth's signals at each capture frame */
export function simulate(rec, tune, opt) {
  const cam = createCamPose(); cam.aspect = rec.aspect;
  Object.assign(cam.tune, tune);
  const fr = rec.frames, ready = f => f.t + opt.cam + opt.infer;
  const out = [];
  let i = 0;
  const t0 = fr[0].t + opt.cam + opt.infer, t1 = fr[fr.length - 1].t;
  for (let r = t0; r <= t1; r += RENDER_DT) {
    while (i < fr.length && ready(fr[i]) <= r) { camIngest(cam, fr[i].res, fr[i].t + opt.cam, false); i++; }
    const J = camPredict(cam, r, tune.lead / 1000);
    out.push({ t: r, a: anglesOf(k => J[k], k => cam.Vis[k] ?? 0) });
  }
  return out;
}

export function truthSignals(rec) {
  const T = truthJoints(rec);
  return rec.frames.map((f, i) => ({ t: f.t, a: T[i] ? anglesOf(k => T[i][k].v, k => T[i][k].vis) : null }));
}

/** truth signal s / side at time t, linear between frames; null when unknown */
function truthAt(tr, dt, t, s, side) {
  const x = (t - tr[0].t) / dt, i = Math.floor(x), k = x - i;
  const a = tr[i], b = tr[i + 1];
  if (!a || !b || !a.a || !b.a) return null;
  const va = a.a[s][side], vb = b.a[s][side];
  return va == null || vb == null ? null : va + (vb - va) * k;
}

/** lag / err / jitter / overshoot for one signal over a run */
function score(fig, tr, s) {
  const dt = tr.length > 1 ? tr[1].t - tr[0].t : 1000 / 30;
  const pairs = lagShift => {
    const p = [];
    for (const f of fig) for (const side of [0, 1]) {
      const o = f.a[s][side], g = truthAt(tr, dt, f.t - lagShift, s, side);
      if (o != null && g != null) p.push([o, g]);
    }
    return p;
  };
  const rms = p => Math.sqrt(p.reduce((a, [o, g]) => a + (o - g) * (o - g), 0) / Math.max(1, p.length));
  const base = pairs(0);
  if (base.length < 30) return null;
  let lag = 0, best = Infinity;
  for (let L = -100; L <= 400; L += 5) { const e = rms(pairs(L)); if (e < best) { best = e; lag = L; } }
  // jitter: the figure's acceleration (° per render frame²) while the person is nearly still (< 15 °/s)
  let jSum = 0, jN = 0, over = 0, range = [Infinity, -Infinity];
  for (let k = 1; k < fig.length - 1; k++) for (const side of [0, 1]) {
    const a = fig[k - 1].a[s][side], b = fig[k].a[s][side], c = fig[k + 1].a[s][side];
    const g0 = truthAt(tr, dt, fig[k].t - 50, s, side), g1 = truthAt(tr, dt, fig[k].t + 50, s, side);
    if (a == null || b == null || c == null || g0 == null || g1 == null) continue;
    if (Math.abs(g1 - g0) / 0.1 < 15) { jSum += (a - 2 * b + c) ** 2; jN++; }
  }
  // overshoot: how far past the person's own extreme (in the surrounding 0.6 s) the figure goes
  for (const f of fig) for (const side of [0, 1]) {
    const o = f.a[s][side]; if (o == null) continue;
    let lo = Infinity, hi = -Infinity;
    for (let d = -300; d <= 300; d += dt) { const g = truthAt(tr, dt, f.t + d, s, side); if (g != null) { lo = Math.min(lo, g); hi = Math.max(hi, g); } }
    if (lo < Infinity) over = Math.max(over, o - hi, lo - o);
    range = [Math.min(range[0], o), Math.max(range[1], o)];
  }
  return { lag, err: rms(base), jitter: Math.sqrt(jSum / Math.max(1, jN)), over, range: range[1] - range[0], n: base.length };
}

export function bench(recs, tune, opt) {
  const per = recs.map(rec => {
    const tr = truthSignals(rec), fig = simulate(rec, tune, opt), r = { name: rec.name };
    for (const s in SIGNALS) r[s] = score(fig, tr, s);
    return r;
  });
  const mean = s => {
    const v = per.map(p => p[s]).filter(Boolean);
    if (!v.length) return null;
    const m = {};
    for (const k of ['lag', 'err', 'jitter', 'over', 'range']) m[k] = v.reduce((a, x) => a + x[k], 0) / v.length;
    return m;
  };
  return { per, mean: Object.fromEntries(Object.keys(SIGNALS).map(s => [s, mean(s)])) };
}

const f1 = x => (x == null ? '   -' : x.toFixed(1).padStart(6));
const row = (label, m) => `${label.padEnd(28)}` + ['knee', 'hip', 'elbow'].map(s => (m[s] ? `${f1(m[s].lag)}${f1(m[s].err)}${f1(m[s].jitter)}${f1(m[s].over)}` : '      -     -     -     -')).join(' |');
const head = () => `${''.padEnd(28)}` + ['knee', 'hip', 'elbow'].map(s => `  ${s.padEnd(22)}`).join('|') + '\n' + ''.padEnd(28) + ['', '', ''].map(() => '   lag   err   jit  over').join(' |');

if (import.meta.url === `file://${process.argv[1]}`) {
  const opt = parseArgs(process.argv.slice(2));
  if (!opt.files.length) { console.error('usage: node tools/follow-bench.mjs <poses.json...> [--cam 50] [--infer 35] [--minCut] [--beta] [--lead] [--sweep]'); process.exit(1); }
  const recs = opt.files.map(loadRec);
  console.log(`latency model: camera ${opt.cam} ms + inference ${opt.infer} ms; lag in ms, err / jitter / overshoot in °`);
  const result = {};
  if (!opt.sweep) {
    const tune = { minCut: opt.minCut, beta: opt.beta, lead: opt.lead, legs: 'normal' };
    const b = bench(recs, tune, opt);
    console.log(head());
    for (const p of b.per) console.log(row(p.name.slice(0, 28), p));
    console.log(row('MEAN', b.mean));
    result.single = { tune, ...b };
  } else {
    const rows = [];
    for (const minCut of [0.8, 1.5, 2.5, 4]) for (const beta of [3, 6, 12, 20]) for (const lead of [0, 60, 100, 150]) {
      const tune = { minCut, beta, lead, legs: 'normal' }, b = bench(recs, tune, opt);
      rows.push({ tune, mean: b.mean });
    }
    rows.sort((a, b) => (a.mean.knee?.lag ?? 1e9) - (b.mean.knee?.lag ?? 1e9));
    console.log(head());
    for (const r of rows) console.log(row(`cut ${r.tune.minCut} β ${r.tune.beta} lead ${r.tune.lead}`, r.mean));
    result.sweep = rows;
  }
  if (opt.json) writeFileSync(opt.json, JSON.stringify(result, null, 1));
}
