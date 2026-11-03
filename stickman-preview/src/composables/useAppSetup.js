// App-wide setup, run once from App.vue: the engine (with the persisted camera settings), the document language
// and the console hook. Everything here lives as long as the app, so it outlives page navigation; page-specific
// setup belongs in the page's view.
import { provideEngine } from './useEngine.js';
import { useDocumentLang } from '../i18n/useI18n.js';
import { useSettings } from '../stores/settings.js';
import { useProfile } from '../stores/profile.js';

/** call once, in App.vue's setup */
export function useAppSetup() {
  const settings = useSettings();
  const { engine } = provideEngine({ profile: useProfile().profile, opts: settings.opts, camView: settings.camView });
  useDocumentLang();
  engine.setCamTune(settings.camTune); engine.setHands(settings.camHands); engine.setPoseModel(settings.camModel); engine.setFitLenient(settings.fitLenient); engine.setBody(settings.body);                     // the persisted camera-following tuning (面板 → 摄像头跟随)
  // entry point for a real heart-rate source (e.g. a Bluetooth strap): stickman.setHeartRate(bpm) on every reading;
  // stickman.setCamLead(ms) tries a prediction lead without saving it (0 = off, the panel's slider saves)
  window.stickman = { setHeartRate: bpm => engine.setHeartRate(bpm), setCamLead: ms => engine.setCamLead(ms) };
}
