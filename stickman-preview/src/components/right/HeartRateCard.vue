<script setup>
// Heart rate: a radial dial (estimated, or measured from a connected device), the beating heart icon, 30 s trend.
import { ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useCard } from '../../composables/useLayout.js';
import { useEngine, useFrame } from '../../composables/useEngine.js';
import { useChart } from '../../composables/useChart.js';
import { zoneOf } from '../../sim/metrics.js';
import { drawHr } from '../../charts/hr.js';
import { drawTrend } from '../../charts/trend.js';

const { t } = useI18n();
const { el: card, style: cardStyle } = useCard('hr');
const { live } = useEngine();
const dial = ref(null), trend = ref(null), chD = useChart(dial), chT = useChart(trend), beat = ref(false);
useFrame(S => {
  beat.value = S.M.beat % 1 < 0.15;
  if (chD.value) drawHr(chD.value, S.M.hr, t(zoneOf(S.M.hr)));
  if (chT.value) drawTrend(chT.value, S.M.trend, S.M.hr);
});
const HEART = 'M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4h2c.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z';
</script>

<template>
  <div
    ref="card"
    class="tile ink"
    data-rz="hr"
    :style="cardStyle"
  >
    <div class="k">
      <svg
        class="heart"
        viewBox="0 0 24 24"
        aria-hidden="true"
        :style="{ transform: `scale(${beat ? 1.25 : 1})` }"
      ><path :d="HEART" /></svg>{{ t('心率') }}<span
        class="est"
        :data-k="live.real ? 'real' : 'est'"
      >{{ t(live.real ? '实测' : '估算') }}</span>
    </div>
    <div class="fill">
      <canvas ref="dial" />
    </div>
    <canvas
      ref="trend"
      class="chart g-trend"
      :aria-label="t('最近 30 秒心率趋势')"
    />
  </div>
</template>
