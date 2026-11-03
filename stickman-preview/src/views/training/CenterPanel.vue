<script setup>
// Centre: the stage (figure + overlay) with its read-outs laid over it.
import { useSettings } from '../../stores/settings.js';
import StageView from '../../components/StageView.vue';
import StageHeader from '../../components/stage/StageHeader.vue';
import ThermCard from '../../components/stage/ThermCard.vue';
import MusclePanel from '../../components/stage/MusclePanel.vue';
import RepCounter from '../../components/stage/RepCounter.vue';
import AngleGauge from '../../components/stage/AngleGauge.vue';
import CamPreview from '../../components/stage/CamPreview.vue';

const settings = useSettings();
// turning the view by hand ends the orbit and any view preset
function onDrag() { settings.opts.orbit = false; settings.view = null; }
</script>

<template>
  <StageView @drag="onDrag">
    <StageHeader />
    <ThermCard />
    <MusclePanel />
    <RepCounter />
    <AngleGauge />
    <CamPreview />
  </StageView>
</template>
