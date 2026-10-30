<script setup>
// Water: intake logged by hand (+200 / +500 / undo) and a bottle on its side showing intake minus the simulated sweat.
import { ref, computed, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from '../../i18n/useI18n.js';
import { useFrame } from '../../composables/useEngine.js';
import { useHydration } from '../../stores/hydration.js';
import { GOAL, netOf, bottleWidth } from '../../sim/hydration.js';

const { t } = useI18n();
const store = useHydration();
const { total, lastEntry } = storeToRefs(store);
const net = ref(0);
onMounted(store.today);
useFrame(S => { net.value = netOf(total.value, S.bio.sweat); });
const hm = ts => { const d = new Date(ts); return d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0'); };
const sub = computed(() => (lastEntry.value ? t('上次 {0} +{1}', hm(lastEntry.value.t), lastEntry.value.ml) : t('目标 {0} ml', GOAL)));
const undoTitle = computed(() => (lastEntry.value ? t('撤销 {0} 的 +{1} ml', hm(lastEntry.value.t), lastEntry.value.ml) : ''));
const BOTTLE = 'M10 2H186C200 2 204 12 214 12H226V28H214C204 28 200 38 186 38H10A8 8 0 0 1 2 30V10A8 8 0 0 1 10 2Z';
</script>

<template>
  <div
    class="tile water"
    data-rz="water"
  >
    <div class="w-top">
      <span class="k">{{ t('水分') }}<span
        class="est"
        data-k="manual"
        :title="t('饮水量手动记录，出汗量为模拟')"
      >{{ t('手动') }}</span></span>
      <span class="num">{{ total }}<small>ml</small></span>
      <span class="row">
        <button
          v-for="ml in [200, 500]"
          :key="ml"
          class="drink"
          type="button"
          @click="store.add(ml)"
        >+{{ ml }}</button>
        <button
          class="drink undo"
          type="button"
          :disabled="!lastEntry"
          :title="undoTitle"
          @click="store.undo()"
        >{{ t('撤销') }}</button>
      </span>
    </div>
    <div class="w-mid">
      <svg
        class="bottle"
        viewBox="0 0 240 40"
        role="img"
        :aria-label="t('横放的水瓶，水量表示已记录的饮水量减去出汗量后的余量，满刻度 2000 毫升')"
      >
        <defs><clipPath id="btlClip"><path :d="BOTTLE" /></clipPath></defs>
        <path
          :d="BOTTLE"
          class="b-glass"
        />
        <rect
          x="0"
          y="0"
          :width="bottleWidth(net)"
          height="40"
          clip-path="url(#btlClip)"
          class="b-water"
        />
        <g
          class="b-marks"
          clip-path="url(#btlClip)"
        ><path d="M48 2V13M94 2V13M140 2V13M186 2V13" /></g>
        <rect
          x="228"
          y="9"
          width="11"
          height="22"
          rx="3"
          class="b-cap"
        />
      </svg>
      <div class="sub w-sub">
        <span>{{ t('余') }} <b>{{ (net < 0 ? '−' : '') + Math.abs(net) }}</b> ml</span><span>{{ sub }}</span>
      </div>
    </div>
  </div>
</template>
