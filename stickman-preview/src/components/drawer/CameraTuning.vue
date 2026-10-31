<script setup>
// Panel · camera following: how the figure trades jitter against lag in camera mode. Presets plus three sliders
// (One Euro cutoff at rest, its rise with speed, prediction lead) and the leg mode; changes apply at once and are saved.
import { computed } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine } from '../../composables/useEngine.js';
import { useSettings } from '../../stores/settings.js';
import { CAM_TUNE_PRESETS, CAM_TUNE_RANGE } from '../../pose/camTune.js';

const MODELS = [['heavy', '高精度'], ['full', '标准']];
const LEGS = [['auto', '自动'], ['stand', '固定站姿']];

const { t } = useI18n();
const { engine } = useEngine();
const settings = useSettings();
const tune = settings.camTune;

/** slider rows: field, label, step, unit, hint */
const SLIDERS = [
  ['minCut', '防抖', 0.1, 'Hz', '越小越稳，站着不动时抖就调小'],
  ['beta', '速度响应', 0.5, '', '越大动起来越跟手，动作拖后就调大'],
  ['lead', '预测提前量', 5, 'ms', '越大越超前，动作停下时冲过头就调小']
];

/** @param {Partial<import('../../pose/camTune.js').CamTune> | null} p  null = defaults */
function apply(p) { settings.setCamTune(p); engine.setCamTune(tune); }
function setModel(m) { settings.camModel = m; engine.setPoseModel(m); }
function setHands(on) { settings.camHands = on; engine.setHands(on); }
const preset = computed(() => {
  const hit = CAM_TUNE_PRESETS.find(([, v]) => v.minCut === tune.minCut && v.beta === tune.beta && v.lead === tune.lead);
  return hit ? hit[0] : null;
});
const show = (k, v) => (k === 'minCut' ? v.toFixed(1) : String(Math.round(v * 10) / 10));
</script>

<template>
  <section>
    <div class="k">
      {{ t('摄像头跟随') }}
    </div>
    <div class="row">
      <div
        class="seg"
        role="group"
        :aria-label="t('跟随预设')"
      >
        <button
          v-for="[name, v] in CAM_TUNE_PRESETS"
          :key="name"
          type="button"
          :aria-pressed="String(preset === name)"
          @click="apply(v)"
        >
          {{ t(name) }}
        </button>
      </div>
      <button
        class="btn"
        type="button"
        @click="apply(null)"
      >
        {{ t('恢复默认') }}
      </button>
    </div>
    <div class="row">
      <span class="note">{{ t('识别精度') }}</span>
      <div
        class="seg"
        role="group"
        :aria-label="t('识别精度')"
      >
        <button
          v-for="[m, name] in MODELS"
          :key="m"
          type="button"
          :aria-pressed="String(settings.camModel === m)"
          @click="setModel(m)"
        >
          {{ t(name) }}
        </button>
      </div>
    </div>
    <p class="note">
      {{ settings.camModel === 'heavy' ? t('高精度模型，四肢位置更准，电脑较慢时帧率会降低') : t('标准模型，速度更快，四肢偶尔对不准') }}
    </p>
    <div class="row">
      <span class="note">{{ t('手部识别') }}</span>
      <div
        class="seg"
        role="group"
        :aria-label="t('手部识别')"
      >
        <button
          v-for="[v, name] in [[true, '开'], [false, '关']]"
          :key="name"
          type="button"
          :aria-pressed="String(settings.camHands === v)"
          @click="setHands(v)"
        >
          {{ t(name) }}
        </button>
      </div>
    </div>
    <p class="note">
      {{ t('识别每根手指，小人的手会跟着握拳、张开和转动手腕；离摄像头近一些更准，会多占一些性能') }}
    </p>
    <div class="row">
      <span class="note">{{ t('腿部') }}</span>
      <div
        class="seg"
        role="group"
        :aria-label="t('腿部跟随方式')"
      >
        <button
          v-for="[m, name] in LEGS"
          :key="m"
          type="button"
          :aria-pressed="String(tune.legs === m)"
          @click="apply({ legs: m })"
        >
          {{ t(name) }}
        </button>
      </div>
    </div>
    <p class="note">
      {{ tune.legs === 'stand' ? t('腿保持站姿，只有上半身跟着你动') : t('腿部看不清时自动回到站姿，膝盖不会反折') }}
    </p>
    <label
      v-for="[k, name, step, unit, hint] in SLIDERS"
      :key="k"
      class="ctune"
    >
      <span class="ctune-h"><span>{{ t(name) }}</span><b>{{ show(k, tune[k]) }} {{ unit }}</b></span>
      <input
        type="range"
        :min="CAM_TUNE_RANGE[k][0]"
        :max="CAM_TUNE_RANGE[k][1]"
        :step="step"
        :value="tune[k]"
        @input="apply({ [k]: Number($event.target.value) })"
      >
      <span class="note">{{ t(hint) }}</span>
    </label>
  </section>
</template>
