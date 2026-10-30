<script setup>
// Joint load (simulated): side view of the posture plus knee / hip / lower-back load as multiples of body weight.
import { ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useFrame } from '../../composables/useEngine.js';
import { useChart } from '../../composables/useChart.js';
import { drawLoad } from '../../charts/load.js';

const { t } = useI18n();
const cv = ref(null), ch = useChart(cv);
const KEYS = [['knee', '膝'], ['hip', '髋'], ['spine', '腰椎']];
const vals = ref(KEYS.map(() => ({ s: '—', w: '0%' })));
useFrame(S => {
  if (ch.value) drawLoad(ch.value, { P: S.sol.P, D: S.sol.D, run: S.run, action: S.action, load: S.load });
  // values are already smoothed in the engine; shown every frame so number and bar move continuously
  vals.value = KEYS.map(([k]) => ({ s: S.load[k].toFixed(1) + '×', w: Math.min(100, S.load[k] / 5 * 100).toFixed(2) + '%' }));
});
</script>

<template>
  <div
    class="tile load"
    data-rz="load"
  >
    <div
      class="k"
      :title="t('承受的力相当于体重的几倍')"
    >
      {{ t('关节负荷') }}<span
        class="est"
        data-k="sim"
      >{{ t('模拟') }}</span>
    </div>
    <div class="fill">
      <canvas
        ref="cv"
        :aria-label="t('侧视的躯干和腿，腰椎、髋、膝三处圆点的大小表示负荷')"
      />
    </div>
    <ol class="mus">
      <li
        v-for="([, name], i) in KEYS"
        :key="name"
      >
        <span>{{ t(name) }}</span><b>{{ vals[i].s }}</b><i :style="{ '--v': vals[i].w }" />
      </li>
    </ol>
  </div>
</template>
