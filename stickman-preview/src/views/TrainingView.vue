<script setup>
// The training screen: left column (balance, water, sweat + joint load) · stage with its read-outs · right column
// (heart rate, energy, vitals) · bottom row. A fragment: each part is a direct child of AppLayout's .app grid.
import { watch } from 'vue';
import { useRoute } from 'vue-router';
import { ACT } from '../core/actions.js';
import { useEngine } from '../composables/useEngine.js';
import SplitHandle from '../components/SplitHandle.vue';
import BottomBar from '../components/BottomBar.vue';
import LeftPanel from './training/LeftPanel.vue';
import CenterPanel from './training/CenterPanel.vue';
import RightPanel from './training/RightPanel.vue';

const route = useRoute();
const { engine } = useEngine();
watch(() => route.query.act, act => {
  if (typeof act === 'string' && Object.hasOwn(ACT, act)) engine.setAction(act);
}, { immediate: true });
</script>

<template>
  <LeftPanel />
  <SplitHandle
    dir="col"
    col="cl"
  />
  <CenterPanel />
  <SplitHandle
    dir="col"
    col="cr"
  />
  <RightPanel />
  <BottomBar />
</template>
