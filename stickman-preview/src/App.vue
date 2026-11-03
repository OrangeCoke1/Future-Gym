<script setup>
// Thin container: app-wide setup (engine with the persisted settings, language, console hook) lives here and
// outlives page navigation; the current route (AppLayout + a page from views/) renders through <RouterView />.
import { watch } from 'vue';
import { provideEngine } from './composables/useEngine.js';
import { useDocumentLang } from './i18n/useI18n.js';
import { useSettings } from './stores/settings.js';
import { useProfile } from './stores/profile.js';

const settings = useSettings();
const { engine } = provideEngine({ profile: useProfile().profile, opts: settings.opts, camView: settings.camView });
useDocumentLang();
// settings → engine, only here: components change the store (opts and profile are shared objects the engine reads every frame).
// immediate = the engine needs the saved value at startup (面板 → 摄像头跟随, 人体模型)
const now = { immediate: true };
watch(settings.camTune, v => engine.setCamTune(v), now);
watch(() => settings.camHands, v => engine.setHands(v), now);
watch(() => settings.camModel, v => engine.setPoseModel(v), now);
watch(() => settings.fitLenient, v => engine.setFitLenient(v), now);
watch(() => settings.body, v => engine.setBody(v), now);
watch(() => settings.camView, v => engine.setCamView(v));        // createEngine already starts with it
watch(() => settings.color, v => engine.setColor(v));            // not persisted; the stage starts in the default colour
// entry point for a real heart-rate source (e.g. a Bluetooth strap): stickman.setHeartRate(bpm) on every reading;
// stickman.setCamLead(ms) tries a prediction lead without saving it (0 = off, the panel's slider saves)
window.stickman = { setHeartRate: bpm => engine.setHeartRate(bpm), setCamLead: ms => engine.setCamLead(ms) };
</script>

<template>
  <RouterView />
</template>
