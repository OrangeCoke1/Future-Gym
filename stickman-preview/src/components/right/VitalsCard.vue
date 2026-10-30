<script setup>
// Vitals (simulated): SpO₂, breathing, core temperature, lactate, muscle oxygen, HRV; refreshed at most 4× a second.
import { ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useFrame } from '../../composables/useEngine.js';
import { bioView } from '../../sim/bio.js';

const { t } = useI18n();
const LABELS = ['血氧 %', '呼吸 /分', '核心体温 °C', '血乳酸 mmol/L', '肌氧 %', '心率变异 ms'];
const vals = ref(LABELS.map(() => '—'));
useFrame(S => {
  const txt = bioView(S.bio, S.M.hr).txt.slice(0, 6);
  if (txt.join('|') !== vals.value.join('|')) vals.value = txt;
}, true);
</script>

<template>
  <div class="bare fixed">
    <div class="k">
      {{ t('体征') }}<span
        class="est"
        data-k="sim"
      >{{ t('模拟') }}</span>
    </div>
    <div class="stats">
      <div
        v-for="(l, i) in LABELS"
        :key="l"
      >
        <b>{{ vals[i] }}</b><span>{{ t(l) }}</span>
      </div>
    </div>
  </div>
</template>
