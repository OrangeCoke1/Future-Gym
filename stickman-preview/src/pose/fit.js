import { TAU } from '../core/math.js';
import { effVis } from './camera.js';

// ================= FIT CAPSULE recognition (ported from media-pipe-practice-main/apps/web/src) =================
// The camera team's rule set, calibrated on recorded real people (their documents/recognition.md). Same pipeline and
// thresholds: raw landmarks → One Euro (1.5 / 1.0 / 1.0) → framing (whole body in view, held 300 ms) → signals from the
// world landmarks (y down, divided by torso length) → exponential smoothing (τ 77 ms) → detectors → arbiter → events
// action_start / rep / action_end. Recognises squat, dumbbell curl / press and jog, only while READY.
// Kept as a straight port so it can be compared with (and updated from) their TypeScript.
// createFit() returns a fresh recogniser: process(res, tMs) per camera frame → events; stop() ends and resets.
//
// LOCAL DEVIATION (not upstream), only while `lenient` is on (面板 → 深蹲识别 → 宽松, the default here): visitors at an
// exhibition squat however they like. Measured on 8 recorded people, the strict rules missed whole sets: at the bottom
// of a squat MediaPipe's knee / ankle visibility sinks to ~0.4, so framing fell to PARTIAL and reset the detector every
// rep; and shallow squats never brought the hips within 0.5 torso of the knees. Lenient mode changes exactly two things:
//   1. framing: a full-body point whose image position is inside the picture counts as visible once its score is at
//      least LEN.frameMin (camera.js effVis; knees read as low as 0.13 while plainly in view);
//   2. squat: besides the strict rule, DOWN also when the hips have come LEN.drop torso lengths closer to the knees than
//      while standing (a knee angle alone swings by 20° with depth noise) and both knees have bent LEN.down° below the person's own standing
//      knee angles (each knee's highest smoothed angle of the last LEN.standWin ms), and the rep counts on the way back
//      up once both are within LEN.up° of them, at least LEN.minRepMs after the rep began.
// Everything else (signals, smoothing, curl / press / jog, the arbiter) is the verbatim port. Strict = upstream exactly.
const LEN = { frameMin: 0.1, down: 15, drop: 0.1, up: 12, standWin: 5000, standMin: 135, minRepMs: 600 };
export function createFit(opts = {}) {
  let lenient = opts.lenient !== false;
  return (() => {
    const CFG = {
      smoothingTauMs: 77,
      squat: { downHipKnee: 0.5, downKnee: 125, upHipKnee: 0.7, upKnee: 145 },
      legsStatic: { windowMs: 1500, minKnee: 150, minHipKnee: 0.7 },
      curl: { flexElbow: 105, flexWristMin: -0.35, flexElbowHeightMax: -0.25, extElbow: 130, extWristMax: -0.5, abortElbowHeight: -0.12, abortWrist: 0.2 },
      press: { upElbow: 150, upWristMin: 0.55, downElbow: 110, downWristMin: -0.2, downWristMax: 0.5 },
      jog: { liftKnee: 135, standKnee: 145 },
      arbiter: { confirmCount: { squat: 1, dumbbell: 2, jog: 4 }, confirmWindowMs: { squat: 0, dumbbell: 5000, jog: 3000 }, idleTimeoutMs: { squat: 4000, dumbbell: 4000, jog: 1500 } },
      visibility: 0.5, framingStableMs: 300, euro: { minCutoff: 1.5, beta: 1.0, dCutoff: 1.0 }
    };
    const I = { LS: 11, RS: 12, LE: 13, RE: 14, LW: 15, RW: 16, LH: 23, RH: 24, LK: 25, RK: 26, LA: 27, RA: 28 };
    const FULL = [11, 12, 23, 24, 25, 26, 27, 28], TORSO = [11, 12, 23, 24], KEYS = ['kneeL', 'kneeR', 'elbowL', 'elbowR', 'wristL', 'wristR', 'elbowHL', 'elbowHR', 'hipKnee'];
    // One Euro filter (time in seconds), one per coordinate of each of the 33 points
    function euro() {
      let px = null, pdx = 0, pt = 0; const { minCutoff, beta, dCutoff } = CFG.euro, sf = (dt, c) => { const r = TAU * c * dt; return r / (r + 1); };
      return { f(x, t) { if (px === null) { px = x; pt = t; return x; } const dt = t - pt; if (dt <= 0) return px;
          const dx = (x - px) / dt, aD = sf(dt, dCutoff), dxh = aD * dx + (1 - aD) * pdx, a = sf(dt, minCutoff + beta * Math.abs(dxh)), xh = a * x + (1 - a) * px;
          px = xh; pdx = dxh; pt = t; return xh; }, reset() { px = null; pdx = 0; } };
    }
    const filters = () => Array.from({ length: 99 }, euro);
    let fLm = filters(), fW = filters();
    const filt = (fs, pts, t) => pts.map((p, i) => ({ x: fs[i * 3].f(p.x, t), y: fs[i * 3 + 1].f(p.y, t), z: fs[i * 3 + 2].f(p.z, t), visibility: p.visibility == null ? 1 : p.visibility }));
    const visOf = p => (p && p.visibility != null ? p.visibility : 1);
    // framing with a 300 ms hold
    const stable = { cur: 'NO_PERSON', cand: 'NO_PERSON', since: 0 };
    function hold(next, now) {
      if (next === stable.cur) { stable.cand = next; return stable.cur; }
      if (next !== stable.cand) { stable.cand = next; stable.since = now; }
      if (now - stable.since >= CFG.framingStableMs) stable.cur = next;
      return stable.cur;
    }
    const classify = pose => !pose ? 'NO_PERSON' : FULL.every(i => { const p = pose.lm[i]; return p && (lenient ? effVis(p.visibility, p, LEN.frameMin) : p.visibility) >= CFG.visibility && p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1; }) ? 'READY' : 'PARTIAL';
    // signals
    function ang(a, b, c) {
      const bax = a.x - b.x, bay = a.y - b.y, baz = a.z - b.z, bcx = c.x - b.x, bcy = c.y - b.y, bcz = c.z - b.z;
      return Math.acos(Math.min(1, Math.max(-1, (bax * bcx + bay * bcy + baz * bcz) / (Math.hypot(bax, bay, baz) * Math.hypot(bcx, bcy, bcz) + 1e-9)))) * 180 / Math.PI;
    }
    function signals(p) {
      const sm = { x: (p[11].x + p[12].x) / 2, y: (p[11].y + p[12].y) / 2, z: (p[11].z + p[12].z) / 2 }, hm = { x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2, z: (p[23].z + p[24].z) / 2 };
      const torso = Math.hypot(sm.x - hm.x, sm.y - hm.y, sm.z - hm.z) + 1e-9, y = i => p[i].y;
      return { kneeL: ang(p[I.LH], p[I.LK], p[I.LA]), kneeR: ang(p[I.RH], p[I.RK], p[I.RA]), elbowL: ang(p[I.LS], p[I.LE], p[I.LW]), elbowR: ang(p[I.RS], p[I.RE], p[I.RW]),
        wristL: (y(I.LS) - y(I.LW)) / torso, wristR: (y(I.RS) - y(I.RW)) / torso, elbowHL: (y(I.LS) - y(I.LE)) / torso, elbowHR: (y(I.RS) - y(I.RE)) / torso,
        hipKnee: ((y(I.LK) + y(I.RK)) / 2 - (y(I.LH) + y(I.RH)) / 2) / torso };
    }
    let sState = null, sT = 0;
    function smooth(s, t) {
      if (!sState) { sState = Object.assign({}, s); sT = t; return sState; }
      const a = 1 - Math.exp(-Math.max(0, t - sT) / CFG.smoothingTauMs); sT = t;
      const n = Object.assign({}, sState); for (const k of KEYS) n[k] = sState[k] + a * (s[k] - sState[k]); return (sState = n);
    }
    // detectors
    let squatPh = 'UP', arms = null, lastLift = null, legHist = [];
    let standHist = [], downAt = 0;                       // lenient squat: recent knee angles (standing reference), when DOWN began
    /** lenient squat: how far each knee is bent below its own standing angle (°): the less bent one (both) and the more
     * bent one (either); null before a reference exists. Per knee, since one knee often reads ~10° straighter than the other */
    function bendBelowStand(s, t) {
      standHist.push({ t, L: s.kneeL, R: s.kneeR, hk: s.hipKnee });
      while (standHist.length > 1 && t - standHist[0].t > LEN.standWin) standHist.shift();
      let sL = -Infinity, sR = -Infinity, sH = -Infinity;
      for (const e of standHist) { if (e.L > sL) sL = e.L; if (e.R > sR) sR = e.R; if (e.hk > sH) sH = e.hk; }
      if (Math.min(sL, sR) < LEN.standMin) return null;    // never seen standing up straight: no reference
      const bL = sL - s.kneeL, bR = sR - s.kneeR;
      return { both: Math.min(bL, bR), either: Math.max(bL, bR), drop: sH - s.hipKnee };
    }
    const newArms = () => [{ side: 'left', e: s => s.elbowL, w: s => s.wristL, h: s => s.elbowHL, curl: 'UNKNOWN', press: 'DOWN' }, { side: 'right', e: s => s.elbowR, w: s => s.wristR, h: s => s.elbowHR, curl: 'UNKNOWN', press: 'DOWN' }];
    arms = newArms();
    function detect(s, t, legsStatic) {
      const out = [], q = CFG.squat, c = CFG.curl, pr = CFG.press, j = CFG.jog;
      if (!lenient) {
        if (squatPh === 'UP' && s.hipKnee < q.downHipKnee && Math.max(s.kneeL, s.kneeR) < q.downKnee) squatPh = 'DOWN';
        else if (squatPh === 'DOWN' && s.hipKnee > q.upHipKnee && (s.kneeL + s.kneeR) / 2 > q.upKnee) { squatPh = 'UP'; out.push({ action: 'squat', side: 'both', t }); }
      } else {
        const b = bendBelowStand(s, t);
        const strictDown = s.hipKnee < q.downHipKnee && Math.max(s.kneeL, s.kneeR) < q.downKnee;
        if (squatPh === 'UP' && (strictDown || (b && b.both >= LEN.down && b.drop >= LEN.drop))) { squatPh = 'DOWN'; downAt = t; }
        else if (squatPh === 'DOWN' && b && b.either <= LEN.up && t - downAt >= LEN.minRepMs) { squatPh = 'UP'; out.push({ action: 'squat', side: 'both', t }); }
      }
      for (const arm of arms) {
        const el = arm.e(s), wr = arm.w(s), ext = el > c.extElbow && wr < c.extWristMax;
        if (wr > c.abortWrist || arm.h(s) > c.abortElbowHeight) arm.curl = 'UNKNOWN';
        else if (arm.curl === 'UNKNOWN') { if (ext) arm.curl = 'EXT'; }
        else if (arm.curl === 'EXT') { if (legsStatic && el < c.flexElbow && wr > c.flexWristMin && arm.h(s) < c.flexElbowHeightMax) arm.curl = 'FLEX'; }
        else if (ext) { arm.curl = 'EXT'; out.push({ action: 'dumbbell', variant: 'curl', side: arm.side, t }); }
        if (arm.press === 'DOWN') { if (legsStatic && el > pr.upElbow && wr > pr.upWristMin) arm.press = 'UP'; }
        else if (el < pr.downElbow && wr > pr.downWristMin && wr < pr.downWristMax) { arm.press = 'DOWN'; out.push({ action: 'dumbbell', variant: 'press', side: arm.side, t }); }
      }
      const lift = s.kneeL < j.liftKnee && s.kneeR > j.standKnee ? 'left' : s.kneeR < j.liftKnee && s.kneeL > j.standKnee ? 'right' : null;
      if (lift && lift !== lastLift) { lastLift = lift; out.push({ action: 'jog', side: lift, t }); }
      return out;
    }
    // arbiter
    let active = null, pending = new Map();
    const keyOf = u => (u.variant ? u.action + ':' + u.variant : u.action);
    const countOf = a => (a.action === 'dumbbell' ? Math.max(a.left, a.right) : a.both + a.left + a.right);
    const addU = (a, u) => { if (u.side === 'left') a.left++; else if (u.side === 'right') a.right++; else a.both++; a.lastAt = u.t; };
    const endA = () => { const a = active; active = null; return { type: 'action_end', action: a.action, variant: a.variant, totalReps: countOf(a), durationMs: a.lastAt - a.startedAt }; };
    function arbiter(units, t) {
      const ev = [], A = CFG.arbiter;
      for (const u of units) {
        const key = keyOf(u);
        if (active && active.key === key) { const b = countOf(active); addU(active, u); const n = countOf(active); if (n > b) ev.push({ type: 'rep', action: u.action, variant: u.variant, side: u.side, count: n }); continue; }
        const list = (pending.get(key) || []).filter(p => u.t - p.t <= A.confirmWindowMs[u.action]); list.push(u); pending.set(key, list);
        if (list.length < A.confirmCount[u.action]) continue;
        if (active) ev.push(endA());
        active = { key, action: u.action, variant: u.variant, startedAt: list[0].t, lastAt: u.t, left: 0, right: 0, both: 0 };
        for (const p of list) addU(active, p);
        pending.clear(); ev.push({ type: 'action_start', action: u.action, variant: u.variant, count: countOf(active) });
      }
      if (active && t - active.lastAt > A.idleTimeoutMs[active.action]) ev.push(endA());
      return ev;
    }
    const flush = () => { pending.clear(); return active ? [endA()] : []; };
    let wasReady = false, tracked = false, last = { framing: 'NO_PERSON', signals: null, legsStatic: false };
    function resetDetect() { sState = null; legHist = []; squatPh = 'UP'; arms = newArms(); lastLift = null; standHist = []; downAt = 0; }
    return {
      get framing() { return last.framing; },
      /** lenient recognition (local deviation, see LEN) on / off; takes effect at once */
      get lenient() { return lenient; },
      set lenient(v) { lenient = !!v; },
      get current() { return active ? { action: active.action, variant: active.variant, count: countOf(active) } : null; },
      debug: () => last,
      /** one camera frame: MediaPipe result + timestamp (ms) → recognition events */
      process(res, tMs) {
        const lm = res && res.landmarks && res.landmarks[0], wl = res && res.worldLandmarks && res.worldLandmarks[0];
        let pose = null;
        if (lm && wl && TORSO.filter(i => visOf(lm[i]) >= CFG.visibility).length >= 2) {
          if (!tracked) { fLm.forEach(f => f.reset()); fW.forEach(f => f.reset()); }
          tracked = true; pose = { lm: filt(fLm, lm, tMs / 1000), world: filt(fW, wl, tMs / 1000) };
        } else { tracked = false; fLm.forEach(f => f.reset()); fW.forEach(f => f.reset()); }
        const framing = hold(classify(pose), tMs); last.framing = framing;
        if (!pose || framing !== 'READY') {
          last.signals = null; last.legsStatic = false;
          if (!wasReady) return [];
          wasReady = false; resetDetect(); return flush();
        }
        wasReady = true;
        const s = smooth(signals(pose.world), tMs), L = CFG.legsStatic;
        legHist.push({ t: tMs, minKnee: Math.min(s.kneeL, s.kneeR), hipKnee: s.hipKnee });
        while (legHist.length > 1 && tMs - legHist[1].t >= L.windowMs) legHist.shift();
        const legsStatic = legHist.every(x => x.minKnee > L.minKnee && x.hipKnee > L.minHipKnee);
        last.signals = s; last.legsStatic = legsStatic;
        return arbiter(detect(s, tMs, legsStatic), tMs);
      },
      /** camera off / mirror flipped: end the current action and start clean */
      stop() { const ev = flush(); resetDetect(); wasReady = false; tracked = false; stable.cur = stable.cand = 'NO_PERSON'; last = { framing: 'NO_PERSON', signals: null, legsStatic: false }; return ev; }
    };
  })();
}

export const FIT_KEY = { squat: 'squat', jog: 'jog', curl: 'curl', press: 'press' };   // their action (dumbbell → variant) → our ACT key
export const fitKeyOf = e => (e.action === 'dumbbell' ? e.variant : e.action);
export const isFitAction = k => k === 'squat' || k === 'jog' || k === 'curl' || k === 'press';
