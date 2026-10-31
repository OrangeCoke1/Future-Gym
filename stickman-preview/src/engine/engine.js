// The frame loop, outside Vue: pose source (demo animation, live camera, or replay of the recognised exercise) → skeleton → rep counting → simulations → stage render and overlay.
// All state is one plain object (S) mutated in place every frame; the UI reads it through onFrame / onTick
// subscribers (see composables/useEngine.js) and changes it only through the methods below.
import { rotX, rotY, clamp, easeIO, TAU } from '../core/math.js';
import { solve, lerpQ, angle3, ground } from '../core/skeleton.js';
import { ACT } from '../core/actions.js';
import { MUS, createMuscles, effortOf, updateMuscles } from '../sim/muscles.js';
import { createLoad, updateLoad } from '../sim/load.js';
import { createMetrics, updateMetrics, setHeartRate } from '../sim/metrics.js';
import { createBio, updateBio } from '../sim/bio.js';
import { balanceOf, smoothBalance } from '../sim/balance.js';
import { createTherm, updateTherm } from '../charts/therm.js';
import { createStage } from '../render/stage.js';
import { drawOverlay } from '../render/overlay.js';
import { ruleOf, showOf, angleOf, updateRep, bump } from './reps.js';
import { createFit, fitKeyOf, isFitAction } from '../pose/fit.js';
import { camSolve, camPredict, HAS_PROP } from '../pose/camera.js';
import { sanitizeTune } from '../pose/camTune.js';
import { phaseTable, phaseAt, bothSides } from './phaseSync.js';
import { createCamera } from './camera.js';

/** @typedef {{ muscle: boolean, oxy: boolean, shade: boolean, line: boolean, angle: boolean, dots: boolean, orbit: boolean }} DisplayOpts */
/** @typedef {{ name: string, n: number, unit: string, t: number, src: string }} SetEntry  one logged action (Chinese source text) */

const UI_DT = 0.25;                                     // live read-outs (angles, percentages, vitals) refresh at most 4× a second
const flip = k => k.slice(0, -1) + (k.endsWith('L') ? 'R' : 'L');

/**
 * @param {{ profile: import('../sim/metrics.js').Profile, opts: DisplayOpts, playing?: boolean, camView?: 'live' | 'replay' }} o
 *   profile and opts are read every frame, so the UI can change them in place
 */
export function createEngine({ profile, opts, playing = true, camView = 'live' }) {
  const S = {
    action: 'squat', tAct: 0, speed: 1, playing,
    count: 0, phase: null, lastLow: null, lastN: 0, repT: [], stateZh: '站立', sets: [],
    curAngle: null, curAngle2: null, curSide: 'L', show: null,
    blendFrom: null, blendT: 1, curQ: null, sol: null,
    cam: { yaw: -0.62, yawT: -0.62, pitch: 0.14, pitchT: 0.14, dragging: false },
    camOn: false, camLive: false,                       // camera mode selected / a person is currently being tracked
    // camera view: 'live' = the figure follows the person's landmarks; 'replay' = the figure plays the recognised exercise
    // as an animation, one full rep for every rep the person completes (jog: half a stride per step)
    camView, mirror: true, camStat: null, camAspect: null,  // camStat = [Chinese text, ...args] or null; camAspect = preview aspect, null = hidden
    RP: { act: null, t: 0, q: 0 }, fitAct: null, fitEnd: null,
    // sync = the action whose scripted rep the replay view is phase-locking to the person's live angle, or null
    sync: null, syncT: 0,
    handG: '',                                          // recognised hand gestures for the camera window: 'L:握拳|R:比 V' (figure side : Chinese label)
    run: playing, rate: 1,                              // what the counters and estimates follow: demo playback, or live tracking
    uiTick: true, uiT: 0, facing: { key: '正面', deg: 0 }, met: ACT.squat.met, real: null,
    mu: createMuscles(), rows: [], recovery: 0, load: createLoad(), M: createMetrics(), bio: createBio(), therm: createTherm(),
    balance: null, balL: 50,
    stage: null, mode: 'particle', dark: true
  };
  const frameSubs = new Set(), tickSubs = new Set();
  let overlay = null, raf = 0, last = 0;
  const FIT = createFit();
  const camera = createCamera({
    onResult: (res, now) => fitEvents(FIT.process(res, now), now),
    onStatus: (text, ...a) => { S.camStat = text ? [text, ...a] : null; },
    onShow: aspect => { S.camAspect = aspect; },
    onFail: () => setSource('demo')
  });
  camera.framingFrom(() => FIT.framing);

  // the working-muscle rows of the current action; their shown values glide toward the target every frame
  const resetRows = () => { S.rows = MUS[S.action].map(([name, lvl]) => ({ name, lvl, dp: 0, df: 0 })); };
  resetRows();

  function logSet() {
    const A = ACT[S.action];
    if (!S.count || A.rep.type === 'none') return;
    S.sets.push({ name: A.name, n: S.count, unit: A.rep.type === 'steps' ? '步' : '次', t: Date.now(), src: S.camOn ? '摄像头' : '演示' });
  }
  function setAction(k) {
    if (k === S.action || !ACT[k]) return;
    logSet();
    S.blendFrom = S.curQ; S.blendT = 0; S.action = k; S.tAct = 0; S.count = 0; S.phase = null; S.lastLow = null; S.lastN = 0; S.repT.length = 0;
    if (ACT[k].rep.type === 'none') S.stateZh = ACT[k].rep.label;
    resetRows();
  }

  // ---- camera: the camera team's recognition (FIT) does the counting for the actions it covers ----
  function replayAdd(k, n) {
    const RP = S.RP;
    if (RP.act !== k) { S.blendFrom = S.curQ; S.blendT = 0; RP.act = k; RP.t = 0; RP.q = 0; }
    RP.q = Math.min(3, RP.q + (k === 'jog' ? 0.5 : 1) * n);      // never more than ~3 reps behind the person
  }
  function fitEvents(events, now) {
    for (const e of events) {
      const k = fitKeyOf(e);
      if (e.type === 'action_start') {
        if (S.action !== k) setAction(k);
        S.fitAct = k; S.fitEnd = null; S.count = 0;
        for (let i = 0; i < e.count; i++) bump(S, now);
        replayAdd(k, k === 'jog' ? Math.min(e.count, 2) : 1);
      } else if (e.type === 'rep' && S.fitAct === k) {
        const n = e.count - S.count; for (let i = 0; i < n; i++) bump(S, now);
        replayAdd(k, n);
      } else if (e.type === 'action_end' && S.fitAct === k) {
        S.fitAct = null; S.fitEnd = { k, total: e.totalReps };
        if (k === 'jog') { S.blendFrom = S.curQ; S.blendT = 0; S.RP.act = null; S.RP.q = 0; }   // a frozen mid-stride looks wrong: back to standing
      }
    }
  }
  /** 'demo' or 'cam'; logs the current action and starts counting afresh */
  function setSource(m) {
    const c = m === 'cam';
    if (c === S.camOn) return;
    logSet();
    S.camOn = c;
    S.count = 0; S.phase = null; S.lastLow = null; S.lastN = 0; S.repT.length = 0; S.blendFrom = null; S.blendT = 1;
    FIT.stop(); S.fitAct = null; S.fitEnd = null; S.RP.act = null; S.RP.q = 0;
    if (c) camera.start(); else { camera.stop(); S.camLive = false; }
    if (ACT[S.action].rep.type === 'none') S.stateZh = ACT[S.action].rep.label;
  }
  function setCamView(v) { S.camView = v === 'replay' ? 'replay' : 'live'; S.blendFrom = S.curQ; S.blendT = 0; }
  /** hand tracking (面板 → 手部识别) on / off */
  function setHands(on) { camera.setHands(on); if (!on) S.handG = ''; }
  /** pose model (面板 → 识别精度): 'heavy' (高精度) or 'full' (标准) */
  function setPoseModel(m) { camera.setModel(m); }
  /** camera following: One Euro minCut / beta and prediction lead (ms); fields left out or invalid keep their value
   * @param {Partial<import('../pose/camTune.js').CamTune>} p */
  function setCamTune(p) { Object.assign(camera.pose.tune, sanitizeTune(p, camera.pose.tune)); }
  let body = 'male';
  /** prediction lead (s) for this frame */
  const lead = () => camera.pose.tune.lead / 1000;
  function setMirror(v) { S.mirror = !!v; camera.setMirror(S.mirror); S.phase = null; S.lastLow = null; }

  /** world-front view presets (radians); the camera turns the short way round */
  function setView(v) { S.cam.yawT = v + TAU * Math.round((S.cam.yawT - v) / TAU); }
  /** drag on the stage: dx / dy in CSS pixels since the last move; pitch only follows a mouse */
  function dragBy(dx, dy, mouse) {
    const c = S.cam;
    c.yawT -= dx * 0.009; c.yaw = c.yawT;
    if (mouse) { c.pitchT = clamp(c.pitchT + dy * 0.004, 0.0, 0.6); c.pitch = c.pitchT; }
  }

  /** hand the stage its canvases; returns false when WebGL is unavailable */
  function attach(gl, fx) {
    S.stage = createStage({ canvas: gl, act: S.mu.musAct, onMode: (m, dark) => { S.mode = m; S.dark = dark; } });
    overlay = fx.getContext('2d');
    if (S.stage && body !== 'male') S.stage.setBody(body);
    return !!S.stage;
  }
  /** CSS size of the stage canvases */
  function resize(width, height) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (overlay) { overlay.canvas.width = Math.max(1, Math.round(width * dpr)); overlay.canvas.height = Math.max(1, Math.round(height * dpr)); }
    if (S.stage) S.stage.resize(width, height, dpr);
  }

  function frame(now) {
    const raw = last ? (now - last) / 1000 : 0, dt = Math.min(0.05, raw); last = now;
    if (S.stage) S.stage.watchPerf(raw);
    S.uiT += dt; S.uiTick = S.uiT >= UI_DT; if (S.uiTick) S.uiT = 0;
    const A = ACT[S.action], c = S.cam, RP = S.RP;
    const replay = S.camOn && S.camView === 'replay';
    if (S.camOn) {
      S.camLive = camera.tick(now);
      if (!replay) S.blendT = 1; else if (S.blendT < 1) S.blendT = Math.min(1, S.blendT + dt / 0.4);
      // replay: play the recognised exercise for as many reps as the person has done (a bit faster when behind)
      if (replay && RP.act && RP.q > 0 && !S.sync) { const Pp = ACT[RP.act].P, s = Math.min(dt * (RP.q > 1.2 ? 1.8 : 1) / Pp, RP.q); RP.t += s * Pp; RP.q -= s; }
      // the exercise has ended and every rep has been shown: back to standing (so no dumbbells left in the hands)
      if (replay && RP.act && RP.q <= 0 && !S.fitAct && !S.sync) { S.blendFrom = S.curQ; S.blendT = 0; RP.act = null; RP.t = 0; }
    } else if (S.playing) { S.tAct += dt * S.speed; if (S.blendT < 1) S.blendT = Math.min(1, S.blendT + dt / 0.6); }
    S.run = S.camOn ? (replay ? RP.q > 0 : S.camLive) : S.playing; S.rate = S.camOn ? 1 : S.speed;
    // camera mode: only credit the action's MET (and muscle effort) while the person is actually moving
    const moving = !S.camOn || camera.pose.motion > 0.08;
    if (opts.orbit && !c.dragging) c.yawT += dt * 0.45;
    const kc = 1 - Math.exp(-dt * 7);
    c.yaw += (c.yawT - c.yaw) * kc; c.pitch += (c.pitchT - c.pitch) * kc;

    // replay view + a tracked person + an exercise counted by one joint angle: follow the person's live angle
    const sk = replay && S.camLive ? RP.act || S.action : null, tab = sk ? phaseTable(sk) : null;
    if ((tab ? sk : null) !== S.sync) {
      S.blendFrom = S.curQ; S.blendT = 0;
      if (tab) S.syncT = phaseAt(tab, bothSides(camPredict(camera.pose, now, lead()), ACT[sk].show));
      else RP.t = 0;                                      // back to the queued replay: from the start of a rep, not mid-squat
      S.sync = tab ? sk : null;
    }

    let sol;
    if (S.camLive && !replay) {
      ground.k = 1 - Math.exp(-dt * 20);
      sol = camSolve(camera.pose, !!S.fitAct && HAS_PROP[S.fitAct], camPredict(camera.pose, now, lead()), now);   // dumbbells only while a dumbbell exercise is being counted
    } else if (S.sync) {
      const A2 = ACT[S.sync], ang = bothSides(camPredict(camera.pose, now, lead()), A2.show);   // the person's raw joint angle (both sides)
      S.syncT += (phaseAt(tab, ang) - S.syncT) * (1 - Math.exp(-dt * 30));
      RP.q = 0;                                           // reps are being shown as they happen: nothing to catch up on
      if (S.blendT < 1) S.blendT = Math.min(1, S.blendT + dt / 0.15);
      let q = A2.pose(S.syncT, A2.P);
      if (S.fitAct !== S.sync) q.prop = 0;               // dumbbells only while that dumbbell exercise is being counted
      if (S.blendFrom && S.blendT < 1) q = lerpQ(S.blendFrom, q, easeIO(S.blendT));
      S.curQ = q;
      ground.k = 1 - Math.exp(-dt * 40);
      sol = solve(q);
    } else {
      // replay: the recognised exercise as an animation (standing idle until something is recognised);
      // live camera with nobody tracked: stand idle instead of playing a scripted exercise
      const R = RP.act && ACT[RP.act];
      let q = replay ? (R ? R.pose(RP.t, R.P) : ACT.idle.pose(now / 1000, ACT.idle.P)) : S.camOn ? ACT.idle.pose(now / 1000, ACT.idle.P) : A.pose(S.tAct, A.P);
      if ((!S.camOn || replay) && S.blendFrom && S.blendT < 1) q = lerpQ(S.blendFrom, q, easeIO(S.blendT));
      S.curQ = q;
      ground.k = 1 - Math.exp(-dt * ((replay ? R && R.gait : A.gait && !S.camOn) ? 4 : 40));
      sol = solve(q);
    }
    S.sol = sol;
    if (S.uiTick) { const H = camera.pose.hands; S.handG = S.camOn ? ['L', 'R'].filter(n => H[n].gesture).map(n => n + ':' + H[n].gesture).join('|') : ''; }
    const { P, D } = sol;
    // camera + the camera team's rules: their events do the counting (fitEvents); the old per-action camera rules
    // still count the actions they do not cover (walk, lunge, …) in the live view
    if (S.camOn && (replay || isFitAction(S.action) || S.fitAct)) {
      S.curAngle = angleOf(S, P);
      S.stateZh = S.fitAct ? '计数中' : S.fitEnd ? '已结束' : FIT.framing === 'READY' ? '请开始运动' : '等待识别';
    } else if (S.run && S.blendT >= 1) updateRep(S, P, D, now);
    else {
      const show = S.camOn ? null : showOf(S, P); S.curAngle = show ? angle3(P[show[0]], P[show[1]], P[show[2]]) : null;
      if (S.camOn) S.stateZh = '等待识别';
    }
    // same joint on the other side of the body, for the left / right comparison on the angle scale
    const shw = S.curAngle == null ? null : showOf(S, P);
    S.show = shw;
    S.curAngle2 = shw ? angle3(P[flip(shw[0])], P[flip(shw[1])], P[flip(shw[2])]) : null;
    S.curSide = shw ? shw[1].slice(-1) : 'L';

    // simulations, in the original order: heart rate / energy → vitals → muscles → joint load
    const mr = updateMetrics(S.M, { action: S.action, moving, run: S.run, rate: S.rate, dt, prof: profile, now });
    S.met = mr.met; S.real = mr.real;
    updateBio(S.bio, { hr: S.M.hr, musE: S.mu.musE, w: profile.w, dt, now });
    S.recovery = updateMuscles(S.mu, { action: S.action, eff: effortOf(ruleOf(S), S.curAngle, P, D, S.run && moving), tint: opts.muscle, dt });
    const glide = 1 - Math.exp(-dt / 0.12);
    for (const r of S.rows) { r.dp += (r.lvl * S.mu.musE * 100 - r.dp) * glide; r.df += ((S.mu.FAT[r.name] || 0) * 100 - r.df) * glide; }
    updateLoad(S.load, P, { action: S.action, run: S.run, dt });
    S.balance = balanceOf(P); S.balL = smoothBalance(S.balL, S.balance.target, dt);
    updateTherm(S.therm, { musAct: S.mu.musAct, temp: S.bio.temp, dt });

    if (S.stage) S.stage.render({ sol, camYaw: c.yaw, camPitch: c.pitch, shade: opts.shade, line: opts.line, oxy: opts.oxy,
      beat: S.M.beat, hr: S.M.hr, spo2: S.bio.spo2, smo2: S.bio.smo2, now });
    const fv = rotX(rotY(D.bodyF, -c.yaw), c.pitch);
    const deg = Math.round(Math.atan2(fv.x, fv.z) * 180 / Math.PI), ad = Math.abs(deg);
    S.facing = { key: ad < 30 ? '正面' : ad > 150 ? '背面' : deg > 0 ? '朝右' : '朝左', deg: ad };
    if (S.stage && overlay) drawOverlay(overlay, { ...S.stage.view, project: S.stage.project, P: S.stage.mapP(P), show: S.show, curAngle: S.curAngle, dark: S.dark, angle: opts.angle, dots: opts.dots });

    for (const f of frameSubs) f(S, dt);
    if (S.uiTick) for (const f of tickSubs) f(S);
    raf = requestAnimationFrame(frame);
  }

  return {
    S, attach, resize, setAction, setView, dragBy, setSource, setCamView, setMirror, setCamTune, setHands, setPoseModel,
    /** console tuning shortcut: prediction lead in ms */
    setCamLead(ms) { setCamTune({ lead: Number(ms) }); },
    /** the camera preview's video element and 2D check canvas */
    attachCamera(video, canvas) { camera.attach(video, canvas); },
    setPlaying(v) { S.playing = !!v; },
    setSpeed(v) { S.speed = v; },
    setMode(m) { if (S.stage) S.stage.mode(m); },
    /** body model (面板 → 人体模型): 'male' | 'xbot' | 'michelle'; kept until the stage exists */
    setBody(k) { body = k; if (S.stage) S.stage.setBody(k); },
    setColor(hex) { if (S.stage) S.stage.color(hex); },
    setHeartRate(bpm) { setHeartRate(S.M, bpm, performance.now()); },
    clearSets() { S.sets.length = 0; },
    /** per-frame subscriber (S, dt); returns an unsubscribe function */
    onFrame(f) { frameSubs.add(f); return () => frameSubs.delete(f); },
    /** subscriber called at most 4× a second (S) */
    onTick(f) { tickSubs.add(f); return () => tickSubs.delete(f); },
    start() { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } },
    stop() { cancelAnimationFrame(raf); raf = 0; }
  };
}
