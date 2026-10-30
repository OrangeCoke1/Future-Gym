// t() for templates and scripts, reactive on the language setting. Strings are the Chinese source text.
import { watchEffect } from 'vue';
import { storeToRefs } from 'pinia';
import { translate } from './messages.js';
import { useSettings } from '../stores/settings.js';

const HTML_LANG = { zh: 'zh-CN', ja: 'ja', en: 'en' };

export function useI18n() {
  const { lang } = storeToRefs(useSettings());
  const t = (s, ...a) => translate(lang.value, s, ...a);
  return { t, lang };
}
/** keep <html lang> and the document title in step with the language (call once, in App) */
export function useDocumentLang() {
  const { t, lang } = useI18n();
  watchEffect(() => { document.documentElement.lang = HTML_LANG[lang.value]; document.title = t('未来健身 2126 · 动作识别原型'); });
}
