<script setup>
// Panel · display: figure style, overlay / shading toggles, layout reset, figure colour.
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine } from '../../composables/useEngine.js';
import { useSettings, COLORS } from '../../stores/settings.js';

const { t } = useI18n();
const { engine, live } = useEngine();
const settings = useSettings();
const BODIES = [['male', '原版'], ['xbot', 'Xbot'], ['michelle', 'Michelle']];
function pickBody(k) { settings.body = k; }
const LOOKS = [['particle', '粒子全息'], ['solid', '实体'], ['moire', '摩尔纹']];
const TOGGLES = [['shade', '光影'], ['line', '轮廓'], ['muscle', '肌群'], ['oxy', '血氧'], ['angle', '角度'], ['dots', '关键点']];
function pickColor(c) { settings.color = c; }
</script>

<template>
  <section>
    <div class="k">
      {{ t('显示') }}
    </div>
    <div class="row">
      <span class="note">{{ t('小人') }}</span>
      <div
        class="seg"
        role="group"
        :aria-label="t('小人的显示方式')"
      >
        <button
          v-for="[m, name] in LOOKS"
          :key="m"
          type="button"
          :aria-pressed="String(live.mode === m)"
          @click="engine.setMode(m)"
        >
          {{ t(name) }}
        </button>
      </div>
    </div>
    <div class="row">
      <span class="note">{{ t('人体模型') }}</span>
      <div
        class="seg"
        role="group"
        :aria-label="t('人体模型')"
      >
        <button
          v-for="[k, name] in BODIES"
          :key="k"
          type="button"
          :aria-pressed="String(settings.body === k)"
          @click="pickBody(k)"
        >
          {{ t(name) }}
        </button>
      </div>
    </div>
    <div class="row">
      <button
        v-for="[k, name] in TOGGLES"
        :key="k"
        class="tg"
        type="button"
        :aria-pressed="String(settings.opts[k])"
        @click="settings.opts[k] = !settings.opts[k]"
      >
        {{ t(name) }}
      </button>
    </div>
    <div class="row">
      <button
        class="btn"
        type="button"
        @click="settings.resetLayout()"
      >
        {{ t('重置布局') }}
      </button><span class="note">{{ t('拖动卡片之间的空隙可以调整大小') }}</span>
    </div>
    <div
      class="sws"
      role="group"
      :aria-label="t('小人颜色')"
    >
      <button
        v-for="[c, name] in COLORS"
        :key="c"
        class="sw"
        type="button"
        :style="{ background: c }"
        :aria-label="t(name)"
        :aria-pressed="String(settings.color === c)"
        @click="pickColor(c)"
      />
    </div>
  </section>
</template>
