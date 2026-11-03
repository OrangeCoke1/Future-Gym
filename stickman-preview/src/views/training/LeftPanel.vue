<script setup>
// Left column: balance, water, then sweat and joint load side by side; the gaps resize the cards.
import { useI18n } from '../../i18n/useI18n.js';
import SplitHandle from '../../components/SplitHandle.vue';
import BalanceCard from '../../components/left/BalanceCard.vue';
import HydrationCard from '../../components/left/HydrationCard.vue';
import SweatCard from '../../components/left/SweatCard.vue';
import LoadCard from '../../components/left/LoadCard.vue';

const { t } = useI18n();
</script>

<template>
  <section
    class="side l"
    :aria-label="t('重心、水分、出汗和关节负荷')"
  >
    <BalanceCard />
    <SplitHandle
      dir="row"
      a="bal"
      b="water"
    />
    <HydrationCard />
    <SplitHandle
      dir="row"
      a="water"
      b="pair"
    />
    <div
      class="pair"
      data-rz="pair"
    >
      <SweatCard />
      <SplitHandle
        dir="col"
        a="sweat"
        b="load"
      />
      <LoadCard />
    </div>
  </section>
</template>
