<script setup>
// Top bar: brand, data source (demo / camera), language, local clock, account (log in / out), panel button.
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from '../i18n/useI18n.js';
import { LANGS } from '../i18n/messages.js';
import { useEngine } from '../composables/useEngine.js';
import { useSettings } from '../stores/settings.js';
import { useAuth } from '../stores/auth.js';
import AuthDialog from './AuthDialog.vue';

defineProps({ drawerOpen: { type: Boolean, required: true } });
const emit = defineEmits({ toggleDrawer: null });
const { t, lang } = useI18n();
const { engine, live } = useEngine();
const settings = useSettings();
const auth = useAuth();
const authOpen = ref(false);
function pickCamView(v) { settings.camView = v; }
const LANG_NAMES = { zh: ['中文', 'zh-CN'], ja: ['日本語', 'ja'], en: ['EN', 'en'] };

const pad = v => String(v).padStart(2, '0');
const clock = ref('--:--:--');
let timer = 0;
const tick = () => { const d = new Date(); clock.value = [d.getHours(), d.getMinutes(), d.getSeconds()].map(pad).join(':'); };
onMounted(() => { tick(); timer = setInterval(tick, 1000); });
onBeforeUnmount(() => clearInterval(timer));
const drawerBtn = ref(null);
defineExpose({ focus: () => drawerBtn.value && drawerBtn.value.focus() });
</script>

<template>
  <header class="top">
    <div class="brand">
      DEVICE LAB<small>{{ t('未来健身 2126') }}</small>
    </div>
    <div class="top-c">
      <div
        class="seg"
        role="group"
        :aria-label="t('数据来源')"
      >
        <button
          v-for="[m, name] in [['demo', '演示'], ['cam', '摄像头']]"
          :key="m"
          type="button"
          :aria-pressed="String(live.camOn === (m === 'cam'))"
          @click="engine.setSource(m)"
        >
          {{ t(name) }}
        </button>
      </div>
      <div
        class="seg"
        role="group"
        :aria-label="t('摄像头模式')"
        :hidden="!live.camOn"
      >
        <button
          v-for="[v, name] in [['live', '实时跟随'], ['replay', '动作复现']]"
          :key="v"
          type="button"
          :aria-pressed="String(live.camView === v)"
          @click="pickCamView(v)"
        >
          {{ t(name) }}
        </button>
      </div>
      <button
        class="tg"
        type="button"
        :aria-pressed="String(live.mirror)"
        :hidden="!live.camOn"
        @click="engine.setMirror(!live.mirror)"
      >
        {{ t('镜像') }}
      </button>
      <span
        class="stat"
        role="status"
        :hidden="!live.camStat"
      >{{ live.camStat ? t(...live.camStat) : '' }}</span>
    </div>
    <div class="top-r">
      <div
        class="seg"
        role="group"
        aria-label="Language"
      >
        <button
          v-for="l in LANGS"
          :key="l"
          type="button"
          :lang="LANG_NAMES[l][1]"
          :aria-pressed="String(lang === l)"
          @click="lang = l"
        >
          {{ LANG_NAMES[l][0] }}
        </button>
      </div>
      <span
        class="clock"
        :aria-label="t('本机时间')"
      >{{ clock }}</span>
      <template v-if="auth.ready">
        <span
          v-if="auth.user"
          class="who"
        >{{ auth.user.username }}<button
          class="btn"
          type="button"
          @click="auth.logout()"
        >
          {{ t('退出') }}
        </button></span>
        <button
          v-else
          class="btn"
          type="button"
          @click="authOpen = true"
        >
          {{ t('登录') }}
        </button>
      </template>
      <button
        ref="drawerBtn"
        class="btn"
        type="button"
        :aria-expanded="String(drawerOpen)"
        aria-controls="drawer"
        @click="emit('toggleDrawer')"
      >
        {{ t('面板') }}
      </button>
    </div>
    <AuthDialog v-model:open="authOpen" />
  </header>
</template>
