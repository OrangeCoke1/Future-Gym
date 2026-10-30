<script setup>
// Energy (estimated): total kcal and one fine bar per 2 s over the last 60 s.
import { ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine, useFrame } from '../../composables/useEngine.js';
import { useChart } from '../../composables/useChart.js';
import { drawKcal } from '../../charts/kcal.js';

const { t } = useI18n();
const { live } = useEngine();
const cv = ref(null), ch = useChart(cv), kcal = ref('0.0');
useFrame(S => {
  kcal.value = S.M.kcal.toFixed(1);
  if (ch.value) drawKcal(ch.value, S.M.slots);
});
</script>

<template>
  <div
    class="bare"
    data-rz="kcal"
  >
    <div class="k">
      {{ t('能量消耗') }}<span
        class="est"
        data-k="est"
      >{{ t('估算') }}</span>
    </div>
    <div class="num">
      {{ kcal }}<small>kcal</small>
    </div>
    <div class="fill">
      <canvas
        ref="cv"
        :aria-label="t('最近 60 秒每 2 秒的消耗')"
      />
    </div>
    <div class="sub">
      {{ t(live.real ? '按实测心率、体重、年龄估算' : '按动作强度（MET）和体重估算') }}
    </div>
  </div>
</template>
