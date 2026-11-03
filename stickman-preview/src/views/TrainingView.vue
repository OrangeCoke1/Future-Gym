<script setup>
// The training screen: left column (balance, water, sweat + joint load) · stage with its read-outs · right column
// (heart rate, energy, vitals) · bottom row. A fragment: each part is a direct child of AppLayout's .app grid.
import { useLayoutVars } from '../composables/useLayout.js';
import SplitHandle from '../components/SplitHandle.vue';
import BottomBar from '../components/BottomBar.vue';
import LeftPanel from './training/LeftPanel.vue';
import CenterPanel from './training/CenterPanel.vue';
import RightPanel from './training/RightPanel.vue';

useLayoutVars();
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
