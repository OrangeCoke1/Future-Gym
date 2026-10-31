<script setup>
// One screen: top bar · left column (balance, water, sweat + joint load) · stage with its read-outs · right column
// (heart rate, energy, vitals) · bottom row; secondary controls in the slide-over panel.
import { ref, watch } from 'vue';
import { provideEngine } from './composables/useEngine.js';
import { useI18n, useDocumentLang } from './i18n/useI18n.js';
import { useSettings } from './stores/settings.js';
import { useProfile } from './stores/profile.js';
import TopBar from './components/TopBar.vue';
import BottomBar from './components/BottomBar.vue';
import StageView from './components/StageView.vue';
import StageHeader from './components/stage/StageHeader.vue';
import ThermCard from './components/stage/ThermCard.vue';
import MusclePanel from './components/stage/MusclePanel.vue';
import RepCounter from './components/stage/RepCounter.vue';
import AngleGauge from './components/stage/AngleGauge.vue';
import CamPreview from './components/stage/CamPreview.vue';
import BalanceCard from './components/left/BalanceCard.vue';
import HydrationCard from './components/left/HydrationCard.vue';
import SweatCard from './components/left/SweatCard.vue';
import LoadCard from './components/left/LoadCard.vue';
import HeartRateCard from './components/right/HeartRateCard.vue';
import EnergyCard from './components/right/EnergyCard.vue';
import VitalsCard from './components/right/VitalsCard.vue';
import SettingsDrawer from './components/drawer/SettingsDrawer.vue';
import SplitHandle from './components/SplitHandle.vue';
import { useLayoutVars } from './composables/useLayout.js';

const settings = useSettings();
const { engine } = provideEngine({ profile: useProfile().profile, opts: settings.opts, camView: settings.camView });
useDocumentLang();
useLayoutVars();
const { t } = useI18n();
// entry point for a real heart-rate source (e.g. a Bluetooth strap): stickman.setHeartRate(bpm) on every reading
// camera prediction lead for tuning on a real webcam: stickman.setCamLead(ms), 0 = off, default 80
window.stickman = { setHeartRate: bpm => engine.setHeartRate(bpm), setCamLead: ms => engine.setCamLead(ms) };

const drawerOpen = ref(false), topBar = ref(null);
watch(drawerOpen, v => { if (!v && topBar.value) topBar.value.focus(); });
function onDrag() { settings.opts.orbit = false; settings.view = null; }
</script>

<template>
  <div
    class="app"
    :style="{ '--cl': settings.layout.cl ? settings.layout.cl + 'px' : null, '--cr': settings.layout.cr ? settings.layout.cr + 'px' : null }"
  >
    <TopBar
      ref="topBar"
      :drawer-open="drawerOpen"
      @toggle-drawer="drawerOpen = !drawerOpen"
    />
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
    <SplitHandle
      dir="col"
      col="cl"
    />
    <StageView @drag="onDrag">
      <StageHeader />
      <ThermCard />
      <MusclePanel />
      <RepCounter />
      <AngleGauge />
      <CamPreview />
    </StageView>
    <SplitHandle
      dir="col"
      col="cr"
    />
    <section
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
    <BottomBar />
  </div>
  <SettingsDrawer v-model:open="drawerOpen" />
</template>
