// Rep counting from the solved skeleton, by the action's rule: joint angle in / out of a range, alternating foot
// strikes, or one per scripted cycle. While a person is tracked the rule's `cam` variant (if any) is used instead.
import { angle3 } from '../core/skeleton.js';
import { ACT } from '../core/actions.js';

/** @typedef {{ action: string, tAct: number, camLive: boolean, count: number, phase: 'in' | 'out' | null, lastLow: 'L' | 'R' | null, lastN: number,
 *   curAngle: number | null, stateZh: string, repT: number[] }} RepState */

/** the active rule: the camera variant while a person is tracked */
export const ruleOf = S => { const A = ACT[S.action]; return (S.camLive && A.rep.cam) || A.rep; };
/** the three joints whose angle is shown (and counted), or null */
export function showOf(S, P) {
  const A = ACT[S.action], c = S.camLive && A.rep.cam;
  if (c && c.show) return c.show(P);
  return typeof A.show === 'function' ? A.show(S.tAct) : A.show;
}
/** angle of the shown joints, or null */
export const angleOf = (S, P) => { const show = showOf(S, P); return show ? angle3(P[show[0]], P[show[1]], P[show[2]]) : null; };

export function bump(S, now) { S.count++; S.repT.push(now); }

/** one frame of counting; also sets curAngle and the state label (Chinese source text) */
export function updateRep(S, P, D, now) {
  const A = ACT[S.action], r = ruleOf(S);
  const show = showOf(S, P);
  S.curAngle = show ? angle3(P[show[0]], P[show[1]], P[show[2]]) : null;
  if (r.type === 'angle') {
    if (S.phase === null) S.phase = r.enter(S.curAngle, P, D) ? 'in' : 'out';
    if (S.phase === 'out' && r.enter(S.curAngle, P, D)) S.phase = 'in';
    else if (S.phase === 'in' && r.exit(S.curAngle, P, D)) { S.phase = 'out'; bump(S, now); }
    S.stateZh = S.phase === 'in' ? r.inL : r.outL;
  } else if (r.type === 'steps') {
    const th = S.camLive ? 0.045 : 0.004;               // real landmarks jitter: need a wider dead band than the scripted gait
    const low = P.anL.y < P.anR.y - th ? 'L' : P.anR.y < P.anL.y - th ? 'R' : S.lastLow;
    if (S.lastLow && low !== S.lastLow) bump(S, now);
    S.lastLow = low; S.stateZh = low === 'L' ? '左脚着地' : '右脚着地';
  } else if (r.type === 'cycle') {
    const n = Math.floor(S.tAct / A.P);
    if (n > S.lastN) { S.lastN = n; bump(S, now); }
    S.stateZh = r.label;
  } else S.stateZh = r.label;
}
