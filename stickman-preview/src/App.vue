<script setup>
// Thin container: app-wide setup (engine with the persisted camera settings, language, console hook) lives here and
// outlives page navigation; the current route (AppLayout + a page from views/) renders through <RouterView />.
import { provideEngine } from './composables/useEngine.js';
import { useDocumentLang } from './i18n/useI18n.js';
import { useSettings } from './stores/settings.js';
import { useProfile } from './stores/profile.js';

const settings = useSettings();
const { engine } = provideEngine({ profile: useProfile().profile, opts: settings.opts, camView: settings.camView });
useDocumentLang();
engine.setCamTune(settings.camTune); engine.setHands(settings.camHands); engine.setPoseModel(settings.camModel); engine.setFitLenient(settings.fitLenient); engine.setBody(settings.body);                     // the persisted camera-following tuning (面板 → 摄像头跟随)
// entry point for a real heart-rate source (e.g. a Bluetooth strap): stickman.setHeartRate(bpm) on every reading;
// stickman.setCamLead(ms) tries a prediction lead without saving it (0 = off, the panel's slider saves)
window.stickman = { setHeartRate: bpm => engine.setHeartRate(bpm), setCamLead: ms => engine.setCamLead(ms) };
</script>

<template>
  <RouterView />
</template>
