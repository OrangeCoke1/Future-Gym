// Counting benchmark: runs the app's recogniser (src/pose/fit.js) over extracted poses (tools/pose-extract.mjs), in
// lenient and strict mode, and compares with the true count when the video's name carries one.
// Name convention: <动作>_<人编号>_<次数>, e.g. 深蹲_01_9.mp4 → 9 squats expected; other names just print what was counted.
// Usage (in stickman-preview/):  node tools/count-bench.mjs tools/poses/*.json
import { loadRec } from './follow-bench.mjs';
import { createFit, fitKeyOf } from '../src/pose/fit.js';

const ACTION_ZH = { 深蹲: 'squat', 弯举: 'curl', 推举: 'press', 慢跑: 'jog', 跑步: 'jog' };

/** expected { action, n } from a name like 深蹲_01_9, or null */
export function expectedOf(name) {
  const m = /^([^_]+)_[^_]+_(\d+)$/.exec(name);
  return m ? { action: ACTION_ZH[m[1]] || m[1], n: Number(m[2]) } : null;
}

/** total reps per action (our ACT keys) over one recording */
export function countRec(rec, lenient) {
  const fit = createFit({ lenient }), total = {};
  let cur = null;
  const end = e => { if (cur) total[cur.k] = (total[cur.k] || 0) + cur.n; cur = null; void e; };
  const feed = evs => {
    for (const e of evs) {
      const k = fitKeyOf(e);
      if (e.type === 'action_start') { end(); cur = { k, n: e.count }; }
      else if (e.type === 'rep' && cur && cur.k === k) cur.n = e.count;
      else if (e.type === 'action_end') end();
    }
  };
  for (const f of rec.frames) feed(fit.process(f.res, f.t + 1));
  feed(fit.stop()); end();
  return total;
}

const fmt = t => Object.entries(t).map(([k, n]) => `${k} ${n}`).join(', ') || '-';

if (import.meta.url === `file://${process.argv[1]}`) {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('usage: node tools/count-bench.mjs <poses.json...>'); process.exit(1); }
  let ok = { lenient: 0, strict: 0 }, known = 0;
  console.log('video'.padEnd(20), 'expected'.padEnd(12), 'lenient'.padEnd(22), 'strict');
  for (const f of files) {
    const rec = loadRec(f), exp = expectedOf(rec.name), L = countRec(rec, true), S = countRec(rec, false);
    const hit = t => exp && (t[exp.action] || 0) === exp.n && Object.keys(t).every(k => k === exp.action);
    if (exp) { known++; if (hit(L)) ok.lenient++; if (hit(S)) ok.strict++; }
    const mark = t => (exp ? (hit(t) ? ' ✓' : ' ✗') : '');
    console.log(rec.name.padEnd(20), (exp ? `${exp.action} ${exp.n}` : '?').padEnd(12), (fmt(L) + mark(L)).padEnd(22), fmt(S) + mark(S));
  }
  if (known) console.log(`correct: lenient ${ok.lenient}/${known}, strict ${ok.strict}/${known}`);
}
