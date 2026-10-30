<script setup>
// Top left of the stage: action name, rep state, then intensity (MET), cadence, active time and data source.
import { ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useEngine, useFrame } from '../../composables/useEngine.js';
import { ACT } from '../../core/actions.js';
import { cadenceOf } from '../../sim/metrics.js';

const { t } = useI18n();
const { live } = useEngine();
const met = ref('—'), cad = ref('—'), cadK = ref('步频 /分'), time = ref('0:00');
useFrame(S => {                                          // cheap strings; refs only trigger a render when they change
  met.value = S.met.toFixed(1);
  const c = cadenceOf({ action: S.action, camOn: S.camOn, speed: S.speed, repT: S.repT, now: performance.now() });
  cad.value = String(c.value); cadK.value = c.label;
  const s = Math.floor(S.M.active); time.value = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
});
</script>

<template>
  <div class="st st-tl">
    <div class="st-h">
      <div class="act">
        {{ t(ACT[live.action].name) }}
      </div>
      <span class="state">{{ t(live.stateZh) }}</span>
    </div>
    <div class="meta">
      <span>{{ t('强度') }} <b>{{ met }}</b> MET</span><span><span>{{ t(cadK) }}</span> <b>{{ cad }}</b></span><span>{{ t('时长') }} <b>{{ time }}</b></span><span>{{ t(live.camOn ? '摄像头' : '演示') }}</span>
    </div>
  </div>
</template>
