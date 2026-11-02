// Offline pose extraction: recorded videos → MediaPipe Pose Landmarker results, frame by frame, saved as JSON.
// Same model files and settings as the app (public/mediapipe/, VIDEO mode, one person), run in headless Chromium.
// Usage (in stickman-preview/):  node tools/pose-extract.mjs <video...> [--out tools/poses] [--fps 30] [--model heavy|full]
// Needs ffmpeg and Playwright (chromium). Each video gives <out>/<name>.json:
//   { name, fps, w, h, model, frames: [{ t, lm, wl }] }  t = ms from the start; lm / wl = 33 × [x, y, z, visibility]
//   flattened (image landmarks 0..1 and world landmarks in metres), or null when nobody was found.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, extname, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = { out: join(ROOT, 'tools/poses'), fps: 30, model: 'heavy', h: 720 };
const videos = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--out') opt.out = resolve(args[++i]);
  else if (a === '--fps') opt.fps = Number(args[++i]);
  else if (a === '--model') opt.model = args[++i] === 'full' ? 'full' : 'heavy';
  else if (a === '--height') opt.h = Number(args[++i]);
  else videos.push(resolve(a));
}
if (!videos.length || !(opt.fps > 0)) { console.error('usage: node tools/pose-extract.mjs <video...> [--out dir] [--fps 30] [--model heavy|full]'); process.exit(1); }
mkdirSync(opt.out, { recursive: true });

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.html': 'text/html', '.jpg': 'image/jpeg', '.task': 'application/octet-stream' };
const PAGE = `<!doctype html><meta charset="utf-8"><script type="module">
import { FilesetResolver, PoseLandmarker } from '/vision/vision_bundle.mjs';
const files = await FilesetResolver.forVisionTasks('/mediapipe/wasm');
window.lm = await PoseLandmarker.createFromOptions(files, { baseOptions: { modelAssetPath: '/mediapipe/' + window.MODEL, delegate: 'CPU' }, runningMode: 'VIDEO', numPoses: 1 });
const flat = a => a ? a.flatMap(p => [p.x, p.y, p.z, p.visibility ?? 1].map(v => Math.round(v * 1e5) / 1e5)) : null;
window.detect = async (url, t) => {
  const img = await createImageBitmap(await (await fetch(url)).blob());
  const r = window.lm.detectForVideo(img, t); img.close();
  return { lm: flat(r.landmarks[0]), wl: flat(r.worldLandmarks[0]) };
};
window.ready = true;
</script>`;

function probeFps(v) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=avg_frame_rate', '-of', 'csv=p=0', v], { encoding: 'utf8' });
  const [a, b] = String(r.stdout).trim().split('/').map(Number);
  return a > 0 && b > 0 ? a / b : 30;
}

const req = createRequire(import.meta.url);
const { chromium } = req('playwright');
const browser = await chromium.launch();
try {
  for (const v of videos) {
    if (!existsSync(v)) { console.error('missing:', v); continue; }
    const name = basename(v, extname(v)), fps = Math.min(opt.fps, probeFps(v));
    const dir = mkdtempSync(join(tmpdir(), 'frames-'));
    const ff = spawnSync('ffmpeg', ['-v', 'error', '-i', v, '-vf', `fps=${fps},scale=-2:'min(${opt.h},ih)'`, '-q:v', '3', join(dir, '%06d.jpg')]);
    if (ff.status !== 0) { console.error('ffmpeg failed on', v, String(ff.stderr)); rmSync(dir, { recursive: true, force: true }); continue; }
    const frames = readdirSync(dir).filter(f => f.endsWith('.jpg')).sort();
    const page = await browser.newPage();
    await page.route('http://x/**', route => {
      const p = new URL(route.request().url()).pathname;
      if (p === '/') return route.fulfill({ body: PAGE, contentType: 'text/html' });
      const file = p.startsWith('/vision/') ? join(ROOT, 'node_modules/@mediapipe/tasks-vision', p.slice(8))
        : p.startsWith('/frames/') ? join(dir, basename(p)) : join(ROOT, 'public', p);
      if (!existsSync(file)) return route.fulfill({ status: 404, body: '' });
      route.fulfill({ body: readFileSync(file), contentType: MIME[extname(file)] || 'application/octet-stream' });
    });
    await page.addInitScript(m => { window.MODEL = m; }, opt.model === 'full' ? 'pose_landmarker_full.task' : 'pose_landmarker_heavy.task');
    await page.goto('http://x/');
    await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
    const out = [], t0 = Date.now();
    let w = 0, h = 0;
    for (let i = 0; i < frames.length; i++) {
      const t = Math.round(i * 1000 / fps * 10) / 10;
      const r = await page.evaluate(([u, tt]) => window.detect(u, tt), ['/frames/' + frames[i], t + 1]);
      out.push({ t, lm: r.lm, wl: r.wl });
      if (i % 60 === 0) process.stdout.write(`\r${name}: ${i + 1}/${frames.length}`);
    }
    const dim = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', join(dir, frames[0])], { encoding: 'utf8' });
    [w, h] = String(dim.stdout).trim().split(',').map(Number);
    await page.close();
    rmSync(dir, { recursive: true, force: true });
    const seen = out.filter(f => f.lm).length;
    writeFileSync(join(opt.out, name + '.json'), JSON.stringify({ name, fps, w, h, model: opt.model, frames: out }));
    console.log(`\r${name}: ${frames.length} frames, person in ${seen}, ${((Date.now() - t0) / 1000).toFixed(0)} s → ${join(opt.out, name + '.json')}`);
  }
} finally { await browser.close(); }
