// t() for templates and scripts, on top of vue-i18n's global composer. Strings are the Chinese source text;
// t('第 {0} 组 · 每组 {1} 次', 2, 12) passes the extra arguments as vue-i18n list values ({0}, {1}).
import { watchEffect } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n as useVueI18n } from 'vue-i18n';
import { useSettings } from '../stores/settings.js';

const HTML_LANG = { zh: 'zh-CN', ja: 'ja', en: 'en' };

export function useI18n() {
  const { lang } = storeToRefs(useSettings());
  const { t: vt } = useVueI18n({ useScope: 'global' });
  const t = (s, ...a) => (a.length ? vt(s, a) : vt(s));
  return { t, lang };
}
/** the settings store's language drives vue-i18n, <html lang> and the document title (call once, in useAppSetup) */
export function useDocumentLang() {
  const { t, lang } = useI18n();
  const { locale } = useVueI18n({ useScope: 'global' });
  watchEffect(() => {
    locale.value = lang.value;
    document.documentElement.lang = HTML_LANG[lang.value];
    document.title = t('未来健身 2126 · 动作识别原型');
  });
}
