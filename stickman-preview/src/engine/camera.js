// Camera source: the webcam stream, the Pose Landmarker, and one detection per camera frame. Like the camera team's
// app, every new camera frame is processed as it arrives (requestVideoFrameCallback), independent of the render loop,
// so a slow frame on screen never drops a frame from the rules; browsers without it fall back to tick() in the loop.
import { createCamPose, camSeed, camIngest, camDraw, loadLandmarker } from '../pose/camera.js';

/**
 * @param {{ onResult: (res: object, now: number) => void, onStatus: (text: string, ...a: unknown[]) => void, onShow: (aspect: string | null) => void, onFail: () => void }} o
 *   onResult: after the pose has been ingested (FIT runs there); onStatus: '' hides the status; onShow: preview aspect ratio, null = hidden;
 *   onFail: the camera could not start (the engine goes back to demo)
 */
export function createCamera({ onResult, onStatus, onShow, onFail }) {
  const cam = createCamPose();
  let lm = null, loading = null, stream = null, tk = 0, rvfc = false, vt = -1, lastTs = 0, fps = 0, fpsT = 0, mirror = true;
  let video = null, g = null, framing = () => 'NO_PERSON';

  function frame() {
    if (!lm || !stream || video.readyState < 2) return;
    const now = Math.max(performance.now(), lastTs + 0.01); lastTs = now;   // detectForVideo needs strictly rising time
    let res = null;
    try { res = lm.detectForVideo(video, now); } catch (e) { console.error(e); }
    if (res) { camIngest(cam, res, now, mirror); if (g) camDraw(g, cam.lm2d); onResult(res, now); }
  }
  function watch(t) {
    if (!video.requestVideoFrameCallback) return;
    const step = () => { if (t !== tk) return; frame(); video.requestVideoFrameCallback(step); };
    rvfc = true; video.requestVideoFrameCallback(step);
  }
  async function start() {
    const t = ++tk, stale = () => t !== tk;
    camSeed(cam); onStatus('请允许使用摄像头…');
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('insecure');
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      if (stale()) { s.getTracks().forEach(tr => tr.stop()); return; }
      stream = s; video.srcObject = s; await video.play();
      const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
      if (g) { g.canvas.width = 336; g.canvas.height = Math.round(336 * vh / vw); }
      onShow(vw + ' / ' + vh);
      if (!lm) {
        onStatus('正在加载识别模型…');
        try { lm = await (loading || (loading = loadLandmarker())); } catch (e) { loading = null; throw e; }
      }
      if (!stale()) { onStatus('未检测到人体 · 请让全身入镜'); watch(t); }
    } catch (e) {
      if (stale()) return;
      console.error(e);
      const msg = e.message === 'insecure' ? '需要通过 localhost 或 https 打开页面才能使用摄像头'
        : e.name === 'NotAllowedError' ? '摄像头权限被拒绝，请在地址栏里允许后重试'
        : e.name === 'NotFoundError' || e.name === 'OverconstrainedError' ? '没有找到可用的摄像头'
        : e.name === 'NotReadableError' ? '摄像头被其他程序占用'
        : '摄像头或识别模型启动失败';
      onFail(); onStatus(msg);
    }
  }
  function stop() {
    tk++; cam.lm2d = null; rvfc = false;
    if (stream) stream.getTracks().forEach(tr => tr.stop());
    stream = null; if (video) video.srcObject = null; onShow(null); onStatus('');
  }
  /** per render frame: fallback detection, whether a person is tracked, the status line once a second */
  function tick(now) {
    if (!rvfc && lm && stream && video.readyState >= 2 && video.currentTime !== vt) { vt = video.currentTime; frame(); }
    if (now - fpsT >= 1000) {
      fps = cam.fpsN; cam.fpsN = 0; fpsT = now;
      const fr = framing();
      if (lm && stream) onStatus(fr === 'READY' ? '跟踪中 · {0} fps' : fr === 'PARTIAL' ? '请后退一点，让全身入镜 · {0} fps' : '未检测到人体 · 请让全身入镜', fps);
    }
    return now - cam.seen < 600;
  }
  return {
    pose: cam, start, stop, tick,
    /** the preview's video element and its 2D check canvas */
    attach(v, c) { video = v; g = c.getContext('2d'); },
    /** where the recognition's framing state comes from (FIT), for the status line */
    framingFrom(f) { framing = f; },
    setMirror(v) { mirror = v; camSeed(cam); }
  };
}
