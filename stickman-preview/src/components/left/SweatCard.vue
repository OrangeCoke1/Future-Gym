<script setup>
// Sweat (simulated): a droplet gauge that fills with the rate, three beads that drip while sweating, total and rate.
import { ref } from 'vue';
import { useI18n } from '../../i18n/useI18n.js';
import { useCard } from '../../composables/useLayout.js';
import { useFrame } from '../../composables/useEngine.js';
import { bioView } from '../../sim/bio.js';

const { t } = useI18n();
const { el: card, style: cardStyle } = useCard('sweat');
const dur = ref('2.4'), on = ref(false), ml = ref(0), rate = ref(150), level = ref(4);
useFrame(S => {
  const v = bioView(S.bio, S.M.hr);
  dur.value = v.dripDur; on.value = v.sweating;                 // the drip pace follows every change
  if (!S.uiTick) return;
  ml.value = v.txt[6]; rate.value = v.txt[7]; level.value = v.dropLevel;
});
const DROP = 'M20 3C20 3 5 22 5 33A15 15 0 0 0 35 33C35 22 20 3 20 3Z';
</script>

<template>
  <div
    ref="card"
    class="tile sweat"
    data-rz="sweat"
    :style="cardStyle"
  >
    <div class="k">
      <span>{{ t(on ? '出汗中' : '出汗') }}</span><span
        class="est"
        data-k="sim"
      >{{ t('模拟') }}</span>
    </div>
    <div
      class="vis"
      aria-hidden="true"
    >
      <svg
        class="drop"
        viewBox="0 0 40 52"
      >
        <defs><clipPath id="dropClip"><path :d="DROP" /></clipPath></defs>
        <rect
          x="0"
          :y="48 - level"
          width="40"
          :height="level"
          clip-path="url(#dropClip)"
        />
        <path :d="DROP" />
      </svg>
      <span
        class="drip"
        :class="{ on }"
        :style="{ '--dur': dur + 's' }"
      ><i /><i /><i /></span>
    </div>
    <div class="num">
      <span>{{ ml }}</span><small>ml</small>
    </div>
    <div class="sub">
      <b>{{ rate }}</b> {{ t('ml/时') }}
    </div>
  </div>
</template>
