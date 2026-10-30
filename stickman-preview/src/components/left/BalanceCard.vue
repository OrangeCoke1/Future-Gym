<script setup>
// Centre of mass and left / right share of weight, from the skeleton (top view).
import { ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useFrame } from '../../composables/useEngine.js';
import { useChart } from '../../composables/useChart.js';
import { drawBal } from '../../charts/balance.js';

const { t } = useI18n();
const cv = ref(null), ch = useChart(cv), left = ref(50);
useFrame(S => {
  if (ch.value && S.balance) drawBal(ch.value, { P: S.sol.P, D: S.sol.D, ...S.balance });
  left.value = Math.round(S.balL);
});
</script>

<template>
  <div
    class="tile bal"
    data-rz="bal"
  >
    <div class="k">
      {{ t('重心与平衡') }}<span class="est">{{ t('骨架计算') }}</span>
    </div>
    <div class="fill">
      <canvas
        ref="cv"
        :aria-label="t('俯视图：双脚位置和身体重心的落点')"
      />
    </div>
    <div class="lr">
      <span>{{ t('左') }} <b>{{ left }}</b>%</span><span>{{ t('右') }} <b>{{ 100 - left }}</b>%</span>
    </div>
  </div>
</template>
