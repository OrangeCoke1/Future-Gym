<script setup>
// Panel · camera following: how the figure trades jitter against lag in camera mode. Presets plus three sliders
// (One Euro cutoff at rest, its rise with speed, prediction lead); changes apply at once and are saved.
import { computed } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine } from '../../composables/useEngine.js';
import { useSettings } from '../../stores/settings.js';
import { CAM_TUNE_PRESETS, CAM_TUNE_RANGE } from '../../pose/camTune.js';

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
