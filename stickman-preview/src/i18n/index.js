// The vue-i18n instance (Composition API mode). Message keys are the Chinese source strings; a string without a
// ja / en entry falls back to zh, which is the key itself, so missing entries are not worth a console warning.
import { createI18n } from 'vue-i18n';
import { messages } from './messages.js';

export const i18n = createI18n({
  legacy: false,
  locale: 'zh',                                         // set from the settings store on startup (useDocumentLang)
  fallbackLocale: 'zh',
  messages,
  missingWarn: false,
  fallbackWarn: false
});
