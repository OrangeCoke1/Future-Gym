# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**Global rules (mandatory, highest priority):** @GLOBAL_RULES.md — respond in Simplified Chinese; for any code change, plan first into `.prompt.md` and wait for `execute` before editing; append every change to `.dev_log`.

## What this is

"未来健身 2126" — a browser prototype for fitness-movement recognition with an animated 3D figure ("100 years from now" theme). The app is `stickman-preview/`, a pure-frontend Vue 3 (JavaScript, `<script setup>`) + Pinia + Vite project. There is no backend and no test suite. `stickman-preview/README.md` (in Chinese) is the detailed feature spec and names the code identifiers behind each feature (`MUS`, `FIT`, `skinOf`, `MOIRE_PX`, …). When you change behaviour it describes, update it too. It is written only in Chinese.

## Commands (run in `stickman-preview/`)

```
npm install
npm run dev       # http://localhost:8000 (strictPort: poster/bake-figure-a.ps1 depends on 8000)
npm run build     # → dist/ (public/ copied as-is, poster/ copied by a plugin in vite.config.js)
npm run preview
npm run lint      # ESLint (flat config, eslint-plugin-vue recommended)
```

The page must be served over `http://localhost`, because camera access and MediaPipe don't work from `file://`. On Windows, `start.bat` builds `dist/` if it is missing (this needs Node), then runs `serve.ps1`, a no-dependency static server whose `-Root` defaults to `dist`. Heart-rate input can be simulated in the console with `stickman.setHeartRate(140)` (`null` disconnects it; it falls back to estimates after 5 s). The camera prediction lead is tuned with `stickman.setCamLead(80)` (ms, `0` = off, max 150).

The baked poster figures are regenerated with `powershell -ExecutionPolicy Bypass -File poster\bake-figure-a.ps1` (add `-Page bake-figures.html -Out figures.js -Var FIGS` for `figures.js`). The server must be running and Edge or Chrome installed. `poster/figure-a.js` and `poster/figures.js` are generated, so don't edit them by hand. `poster/` is a separate static site with classic scripts and is not bundled by Vite.

## Architecture

The key split is a **plain-JS engine with no Vue inside** that runs every frame, plus Vue components that only display its state. Keep per-frame work out of Vue reactivity: skinning ~42k vertices and ~22k particles on the CPU at 60 fps.

- **`src/engine/engine.js`**: `createEngine()` owns the rAF loop and one state object `S`, mutated in place. Each frame runs pose source → skeleton → rep counting → simulations → stage render → overlay. The pose source is the demo animation, the live camera (`camSolve`), or replay of the recognised exercise (`S.RP`). The UI changes `S` only through engine methods (`setAction`, `setSource`, `setCamView`, `setMode`, …). It reads `S` through `onFrame` / `onTick` (≤4×/s) subscribers.
- **`src/composables/useEngine.js`**: `provideEngine` (in `App.vue`) / `useEngine` / `useFrame`. `live` is a `shallowReactive` mirror of the few values templates need, written only when a value changes. To expose a new engine value to templates, add it to `pick`. Engine methods that change mirrored values are wrapped to `sync()` immediately.
- **`src/core/`**: `{x,y,z}` vector math, the skeleton (`B`, `solve(q)` → `{P, D}`, `lerpQ`), and `ACT`. `ACT` is the 12 actions, each with a scripted `pose(t)`, a `rep` rule (with an optional `rep.cam` override while a person is tracked), and `met`. Ground contact smoothing is the shared `ground` object and `settleGround()`, also used by the camera retargeting.
- **`src/sim/`**: simulated or estimated data (muscles/fatigue, joint load, heart rate/energy with Keytel, vitals/sweat, hydration, centre of mass). These are pure functions over small state objects.
- **`src/pose/fit.js`**: `createFit()`. This is a **verbatim port of the camera team's `media-pipe-practice-main/apps/web/src` rules**. Keep it in sync with upstream rather than tuning it here. Its events drive counting in camera mode (`fitEvents` in the engine). In the replay view, actions with an `angle` rep rule are phase-synced instead (`src/engine/phaseSync.js`): the person's live joint angle picks the point of the scripted rep, so the figure moves with the person. Other actions replay after each counted rep.
- **`src/pose/camera.js` and `src/engine/camera.js`**: landmark → skeleton retargeting that keeps the figure's own bone lengths (One Euro filtered, then `camPredict` extrapolates each joint by its velocity to hide the camera and model delay), plus the webcam / Pose Landmarker lifecycle. MediaPipe comes from npm `@mediapipe/tasks-vision@0.10.14`; its wasm and model are served from `public/mediapipe/`, which must stay the same version.
- **`src/render/`**: `createStage()` (returns `null` without WebGL). `male_body.glb` is parsed by hand and skinned on the CPU: `rig.js` handles nearest-bone weights with joint blending, `poser.js` handles bone rotations, `blend` and the shoulder girdle, and `bodyModel.js` adds heat-diffusion shoulder weights. Until the model loads, the procedural SDF body (`sdfBody.js`) and procedural particles are used instead. There are three looks: solid, particle hologram (default) and moiré. `three` is pinned to 0.149.0 because the shaders are written against r149.
- **`src/charts/`**: pure 2D draw functions taking a `Chart` (`{c, g, w, h, d}`, sized by `useChart`).
- **`src/stores/`** (Pinia): settings (lang, display opts, colour, view, layout, camView), profile, hydration. They persist to localStorage under the original `stick.*` keys through `utils/storage.js`, which sanitises every read.
- **i18n**: vue-i18n (Composition API, global scope; instance in `src/i18n/index.js`). Message keys are the **Chinese source strings**. `I18N` in `src/i18n/messages.js` (`'中文': [ja, en]`) generates the zh / ja / en messages, and zh maps each key to itself, with fallback to zh. Use `t('中文原文', ...args)` from `src/i18n/useI18n.js` (the args become list values `{0}`, `{1}`) and add ja/en entries for new strings. vue-i18n parses messages, so `@ $ | { }` in a string (other than `{0}`-style placeholders) must be escaped. The settings store's `lang` (persisted) drives the vue-i18n locale through `useDocumentLang()` in App. Engine and sim code keep state labels as Chinese source text (`S.stateZh`, set entries), and the UI translates them.
- **Styles**: the original stylesheet is split under `src/styles/` and is global, not scoped. Layout depends on its class names and `data-rz` card keys (`SplitHandle` + `useLayout.js` resize cards via `--g`, `--cl` and `--cr`).

## Constraints to keep

- `male_body.glb` ("Male Body" by Alexander Antipov) is **CC BY 4.0**. Keep the attribution in 面板 → 数据说明 (`DataNotes.vue`) and on posters A, D, E and F.
- Every value labelled 模拟 is concept simulation, never sensor data. Keep the provenance labels (估算 / 实测 / 手动记录 / 模拟) accurate.
- Camera counting has only been verified against recorded or synthetic video in headless Chromium (about 5 fps), not a live webcam.
