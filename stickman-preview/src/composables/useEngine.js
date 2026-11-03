// Bridges the plain-JS engine to Vue: one engine per app (provideEngine in useAppSetup, useEngine in components).
// `live` mirrors the few engine values the UI shows; it is only written when a value actually changes, so
// components re-render at the rate the numbers change, not at the frame rate.
import { inject, provide, shallowReactive, markRaw, onBeforeUnmount } from 'vue';
import { createEngine } from '../engine/engine.js';

const KEY = Symbol('engine');

/** @returns {{ engine: ReturnType<typeof createEngine>, live: object }} */
export function provideEngine({ profile, opts, camView }) {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const engine = markRaw(createEngine({ profile, opts, camView, playing: !reduced }));
  const S = engine.S;
  const pick = { action: () => S.action, playing: () => S.playing, speed: () => S.speed, count: () => S.count, stateZh: () => S.stateZh,
    mode: () => S.mode, dark: () => S.dark, camOn: () => S.camOn, real: () => S.real != null, setsN: () => S.sets.length,
    camView: () => S.camView, mirror: () => S.mirror, camStat: () => S.camStat, camAspect: () => S.camAspect, handG: () => S.handG };
  const live = shallowReactive(Object.fromEntries(Object.entries(pick).map(([k, f]) => [k, f()])));
  const sync = () => { for (const k in pick) { const v = pick[k](); if (live[k] !== v) live[k] = v; } };
  engine.onFrame(sync);
  // method calls change S right away; mirror them without waiting for the next frame
  for (const m of ['setAction', 'setPlaying', 'setSpeed', 'setMode', 'clearSets', 'setSource', 'setCamView', 'setMirror']) { const f = engine[m]; engine[m] = (...a) => { f(...a); sync(); }; }
  const ctx = { engine, live };
  provide(KEY, ctx);
  engine.start();
  onBeforeUnmount(() => engine.stop());
  return ctx;
}

/** @returns {{ engine: ReturnType<typeof createEngine>, live: object }} */
export function useEngine() {
  const ctx = inject(KEY, null);
  if (!ctx) throw new Error('useEngine() outside provideEngine()');
  return ctx;
}

/** subscribe for the component's lifetime: per frame, or (tick = true) at most 4× a second */
export function useFrame(fn, tick = false) {
  const { engine } = useEngine();
  const off = tick ? engine.onTick(fn) : engine.onFrame(fn);
  onBeforeUnmount(off);
}
