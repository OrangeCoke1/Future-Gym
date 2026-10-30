// The 12 demo actions: scripted pose over time, the rep rule used for counting, MET (metabolic equivalent, drives the
// estimates) and the joints whose angle is shown. A rule's optional `cam` overrides it while a person is tracked.
import { V, dot, sub, lerp, sine, TAU } from './math.js';
import { base, gait, cycle, limbP, angle3 } from './skeleton.js';

/** @typedef {{ type: 'none' | 'steps' | 'cycle' | 'angle', label?: string, at?: string, th?: [number, number], inL?: string, outL?: string, rule?: string,
 *   enter?: Function, exit?: Function, show?: Function, cam?: object }} RepRule */
/** @typedef {{ name: string, grp: 1 | 2, P: number, met: number, gait?: boolean, rep: RepRule, show: string[] | Function | null, rule: string,
 *   pose: (t: number, P: number) => import('./skeleton.js').PoseQ }} ActionDef */

// helpers for the camera-mode rep rules (rep.cam): time-based 'cycle' counting only makes sense for the scripted demo
export const kneeA = (P, n) => angle3(P['hip' + n], P['kn' + n], P['an' + n]);
export const upHand = P => P.wrL.y > P.wrR.y ? 'L' : 'R';
export const waveS = (P, D) => { const n = upHand(P); return P['wr' + n].y > P['sh' + n].y ? dot(sub(P['wr' + n], P['el' + n]), D.side) : 0; };
export const feetGap = P => Math.hypot(P.anL.x - P.anR.x, P.anL.z - P.anR.z);

/** @type {Record<string, ActionDef>} */
export const ACT = {
  idle: { name: '待机', grp: 1, P: 3.2, met: 1.3, rep: { type: 'none', label: '站立' }, show: null, rule: '不计数，用于站立和动作之间的过渡',
    pose(t) { const q = base(), br = Math.sin(TAU * t / 3.2), sl = Math.sin(TAU * t / 6.4);
      q.lean = 0.03 + 0.012 * br; q.armL.a = 0.14 + 0.02 * br; q.armR.a = 0.14 + 0.02 * br;
      q.nod = 0.03 * sl; q.side = 0.012 * sl; q.tilt = 0.025 * sl; return q; } },
  walk: { name: '走路', grp: 1, P: 1.1, met: 3.5, gait: true, rep: { type: 'steps' }, show: ['hipL', 'knL', 'anL'], rule: '左右脚交替着地一次 = 1 步',
    pose(t, P) { const q = base(), w = TAU * t / P;
      gait(q, w, { A: 0.42, ks: 0.95, kb: 0.08, arm: 0.42, elb: 0.35, toe: 0.35, tw: 0.14 });
      // a little life: the body rises over each stance leg and sways toward it, the head stays steadier than the trunk
      q.lean = 0.05; q.jump = 0.012 * Math.cos(2 * w); q.side = 0.025 * Math.sin(w); q.tilt = -0.02 * Math.sin(w); q.nod = 0.015 * Math.sin(2 * w); return q; } },
  turn: { name: '转身', grp: 1, P: 4, met: 2.0, gait: true, rep: { type: 'none', label: '转身中' }, show: null, rule: '用左右肩（11、12）连线算出身体朝向，小人跟着转',
    pose(t) { const q = base(), k = Math.floor(t / 2), loc = t % 2;
      const fr = loc < 1.3 ? sine(loc / 1.3) : 1, spd = loc < 1.3 ? Math.sin(Math.PI * loc / 1.3) : 0;
      q.yaw = Math.PI * (k + fr);
      const ws = TAU * t / 0.55;
      for (const [n, ph] of [['L', ws], ['R', ws + Math.PI]]) {
        const lift = 0.32 * spd * Math.max(0, Math.sin(ph)); q['leg' + n].f = lift; q['leg' + n].e = 0.04 + 2 * lift; q['leg' + n].toe = lift;
      }
      q.armL.a = q.armR.a = 0.14 + 0.12 * spd; q.nod = -0.04 * spd; q.anchor = 0; return q; } },
  wave: { name: '挥手', grp: 1, P: 1.0, met: 1.8, rep: { type: 'cycle', at: 'handR', label: '挥手',
      cam: { type: 'angle', inL: '挥手', outL: '挥手', show: P => { const n = upHand(P); return ['sh' + n, 'el' + n, 'wr' + n]; },
        enter: (a, P, D) => waveS(P, D) > 0.06, exit: (a, P, D) => waveS(P, D) < -0.06 } }, show: ['shR', 'elR', 'wrR'], rule: '手腕高于肩并左右摆动一次 = 1 次',
    pose(t, P) { const q = base(), w = TAU * t / P;
      q.armR = limbP(0.25, 2.55, 0.55 + 0.42 * Math.sin(w), 0, V(1, 0.3, 0.15));
      q.tilt = -0.07; q.side = -0.03; q.nod = 0.03 * Math.sin(w); return q; } },
  squat: { name: '深蹲', grp: 2, P: 3.0, met: 5.0, show: ['hipL', 'knL', 'anL'],
    rep: { type: 'angle', th: [100, 160], enter: a => a < 100, exit: a => a > 160, inL: '蹲到位', outL: '站直' }, rule: '膝角 < 100° → > 160° 计 1 次',
    pose(t, P) { const q = base(), d = cycle(t, P, [0.4, 0.07, 0.33]);
      for (const n of ['L', 'R']) { q['leg' + n] = limbP(0.04 + 1.6 * d, 0.16, 0.04 + 2.05 * d); q['arm' + n] = limbP(0.04 + 2.1 * Math.pow(d, 0.8), 0.14 - 0.04 * d, 0.2 - 0.1 * d); }
      q.lean = 0.04 + 0.62 * d; q.nod = -0.12 * d; return q; } },
  lunge: { name: '弓步', grp: 2, P: 2.8, met: 4.0, show: t => Math.floor(t / 2.8) % 2 ? ['hipR', 'knR', 'anR'] : ['hipL', 'knL', 'anL'],
    rep: { type: 'cycle', at: 'knL', label: '弓步',
      cam: { type: 'angle', inL: '蹲到位', outL: '站直', rule: '任一侧膝角 < 110° → 双膝 > 155° 计 1 次',
        show: P => kneeA(P, 'L') <= kneeA(P, 'R') ? ['hipL', 'knL', 'anL'] : ['hipR', 'knR', 'anR'], enter: a => a < 110, exit: a => a > 155, th: [110, 155] } }, rule: '前腿膝角接近 90° 再站起 = 1 次（左右交替）',
    pose(t, P) { const q = base(), d = cycle(t, P, [0.36, 0.12, 0.34]), front = Math.floor(t / P) % 2 ? 'R' : 'L', rear = front === 'L' ? 'R' : 'L';
      q['leg' + front] = limbP(1.4 * d, 0.06, 1.5 * d);
      q['leg' + rear] = limbP(-0.25 * d, 0.06, 0.04 + 1.15 * d, 0.95 * d);
      q.lean = 0.06 * d; q.armL = limbP(0.05, 0.16 + 0.12 * d, 0.2 + 0.2 * d); q.armR = limbP(0.05, 0.16 + 0.12 * d, 0.2 + 0.2 * d); return q; } },
  jog: { name: '慢跑', grp: 2, P: 0.72, met: 7.0, gait: true, rep: { type: 'steps' }, show: ['hipL', 'knL', 'anL'], rule: '左右脚交替着地一次 = 1 步',
    pose(t, P) { const q = base(), w = TAU * t / P;
      gait(q, w, { A: 0.55, ks: 1.45, kb: 0.28, arm: 0.6, elb: 1.45, toe: 0.5, tw: 0.2 });
      q.lean = 0.16; q.jump = 0.025 * Math.sin(2 * w); q.side = 0.02 * Math.sin(w); q.tilt = -0.025 * Math.sin(w); q.nod = 0.025 * Math.sin(2 * w); return q; } },
  high: { name: '高抬腿', grp: 2, P: 0.62, met: 8.0, gait: true, rep: { type: 'steps' }, show: ['hipL', 'knL', 'anL'], rule: '膝盖抬到髋部高度，左右各一次 = 2 步',
    pose(t, P) { const q = base(), w = TAU * t / P;
      for (const [n, ph] of [['L', w], ['R', w + Math.PI]]) {
        const s = Math.pow(Math.max(0, Math.sin(ph)), 1.3);
        q['leg' + n] = limbP(1.45 * s, 0.07, 0.12 + 1.6 * s, 0.45 * s);
        q['arm' + n] = limbP(-0.85 * Math.sin(ph), 0.18, 1.6);
      }
      q.twist = 0.14 * Math.sin(w); q.lean = 0.02; q.jump = 0.03 * Math.abs(Math.sin(w)); q.side = 0.02 * Math.sin(w); q.tilt = -0.02 * Math.sin(w); q.anchor = 0; return q; } },
  jacks: { name: '开合跳', grp: 2, P: 1.0, met: 8.0, rep: { type: 'cycle', at: 'chest', label: '开合',
      cam: { type: 'angle', inL: '打开', outL: '收回',
        enter: (a, P) => P.wrL.y > P.head.y && P.wrR.y > P.head.y && feetGap(P) > 0.45,
        exit: (a, P) => P.wrL.y < P.shL.y && P.wrR.y < P.shR.y && feetGap(P) < 0.36 } }, show: ['hipL', 'shL', 'elL'], rule: '双手过头 + 双脚分开，再收回 = 1 次',
    pose(t, P) { const q = base(), w = TAU * t / P, d = 0.5 - 0.5 * Math.cos(w), hop = Math.abs(Math.sin(w));
      for (const n of ['L', 'R']) { q['arm' + n] = limbP(0.1, 0.16 + 2.4 * d, 0.15 + 0.3 * Math.sin(Math.PI * d)); q['leg' + n] = limbP(0, 0.06 + 0.3 * d, 0.08 + 0.15 * (1 - hop), 0.3 * hop); }
      q.jump = 0.11 * hop; q.anchor = 0; return q; } },
  curl: { name: '弯举', grp: 2, P: 2.6, met: 3.5, show: ['shL', 'elL', 'wrL'],
    rep: { type: 'angle', th: [50, 150], enter: a => a < 50, exit: a => a > 150, inL: '收紧', outL: '伸直' }, rule: '肘角 < 50° → > 150° 计 1 次',
    pose(t, P) { const q = base(), d = cycle(t, P, [0.32, 0.08, 0.42]);
      for (const n of ['L', 'R']) q['arm' + n] = limbP(0.05 + 0.12 * d, 0.14, 0.15 + 2.35 * d);
      q.lean = 0.03 + 0.02 * Math.sin(Math.PI * d); q.prop = 1; q.nod = -0.08 * d; return q; } },
  press: { name: '推举', grp: 2, P: 2.8, met: 4.0, show: ['shL', 'elL', 'wrL'],
    rep: { type: 'angle', th: [100, 160], enter: a => a < 100, exit: a => a > 160, inL: '架肩', outL: '推起' }, rule: '肘角 < 100° → > 160° 且手腕高于头顶',
    pose(t, P) { const q = base(), d = cycle(t, P, [0.3, 0.08, 0.42]), mid = Math.sin(Math.PI * d);
      for (const n of ['L', 'R']) q['arm' + n] = limbP(lerp(0.45, 0.08, d), lerp(1.35, 2.8, d), lerp(1.6, 0.08, d), 0, V(0, 1, 0.2));
      q.lean = -0.04 * mid; q.nod = -0.12 * mid; q.prop = 1; return q; } },
  lateral: { name: '侧平举', grp: 2, P: 2.6, met: 3.5, show: ['hipL', 'shL', 'elL'],
    rep: { type: 'angle', th: [30, 75], enter: a => a > 75, exit: a => a < 30, inL: '举平', outL: '放下' }, rule: '手臂与躯干夹角 > 75° → < 30° 计 1 次',
    pose(t, P) { const q = base(), d = cycle(t, P, [0.34, 0.1, 0.4]);
      for (const n of ['L', 'R']) q['arm' + n] = limbP(0.18, 0.18 + 1.38 * d, 0.3);
      q.prop = 1; q.lean = 0.05; return q; } }
};
