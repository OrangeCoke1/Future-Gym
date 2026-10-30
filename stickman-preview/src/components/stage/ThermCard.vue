<script setup>
// Thermal body map (simulated), left middle of the stage. Hidden when the stage is too short to fit it between the
// action name and the rep counter; redrawn at most 4× a second.
import { ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useFrame } from '../../composables/useEngine.js';
import { useChart } from '../../composables/useChart.js';
import { drawTherm } from '../../charts/therm.js';

const { t } = useI18n();
const root = ref(null), cv = ref(null), hidden = ref(false);
const ch = useChart(cv);
useFrame(S => {
  const stage = root.value && root.value.parentElement;
  if (!stage) return;
  hidden.value = stage.clientHeight < 470;
  if (hidden.value || !S.uiTick || !ch.value) return;
  const { w, h } = ch.value;
  if (w < 20 || h < 20) return;
  drawTherm(ch.value, S.therm);
});
</script>

<template>
  <div
    ref="root"
    class="st st-ml"
    :hidden="hidden"
  >
    <div class="k">
      <span>{{ t('体表热量') }}</span><span
        class="est"
        data-k="sim"
      >{{ t('模拟') }}</span>
    </div>
    <canvas
      ref="cv"
      :aria-label="t('正面摊开的人体热成像图，越亮表示越热')"
    />
    <div
      class="therm-scale"
      aria-hidden="true"
    >
      <i />
    </div>
  </div>
</template>
