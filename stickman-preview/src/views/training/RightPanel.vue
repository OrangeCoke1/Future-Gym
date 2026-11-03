<script setup>
// Right column: heart rate, energy, vitals.
import { useI18n } from '../../i18n/useI18n.js';
import { layoutRef } from '../../composables/useLayout.js';
import SplitHandle from '../../components/SplitHandle.vue';
import HeartRateCard from '../../components/right/HeartRateCard.vue';
import EnergyCard from '../../components/right/EnergyCard.vue';
import VitalsCard from '../../components/right/VitalsCard.vue';

const { t } = useI18n();
const side = layoutRef('cr');
</script>

<template>
  <section
    ref="side"
    class="side r"
    :aria-label="t('身体数据')"
  >
    <HeartRateCard />
    <SplitHandle
      dir="row"
      a="hr"
      b="kcal"
    />
    <EnergyCard />
    <VitalsCard />
  </section>
</template>
