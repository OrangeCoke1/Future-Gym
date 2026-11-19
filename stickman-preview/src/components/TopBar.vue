<script setup>
// Top bar: brand, data source (demo / camera), language, local clock, panel button.
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useI18n } from '../i18n/useI18n.js';
import { LANGS } from '../i18n/messages.js';
import { useEngine } from '../composables/useEngine.js';
import { useSettings } from '../stores/settings.js';

defineProps({ drawerOpen: { type: Boolean, required: true } });
const emit = defineEmits({ toggleDrawer: null });
const { t, lang } = useI18n();
const { engine, live } = useEngine();
const settings = useSettings();
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
    <div class="top-brand">
      <RouterLink
        class="btn"
        :to="{ name: 'lobby' }"
      >
        {{ t('← 健身舱') }}
      </RouterLink>
      <div class="brand">
        DEVICE LAB<small>{{ t('未来健身 2126') }}</small>
      </div>
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
  </header>
</template>
