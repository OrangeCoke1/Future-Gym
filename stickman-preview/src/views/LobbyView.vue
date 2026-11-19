<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useEngine } from '../composables/useEngine.js';
import { useLobby } from '../stores/lobby.js';
import { createLobby } from '../lobby/lobbyScene.js';
import LobbyHud from './lobby/LobbyHud.vue';

const router = useRouter();
const { engine } = useEngine();
const visit = useLobby();
const canvas = ref(null);
const hud = ref(null);
const fallback = ref(false);
const active = ref(null);
let lobby, observer;

function unavailable() {
  lobby = null;
  active.value = null;
  fallback.value = true;
}


onMounted(() => {
  engine.stop();
  visit.introSeen = true;
  lobby = createLobby({
    canvas: canvas.value,
    reduced: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    onHover: id => { active.value = id; },
    onLabels: labels => hud.value?.positionLabels(labels),
    onPick: enter,
    onUnavailable: unavailable,
  });
  if (!lobby) unavailable();
  else {
    const fit = () => { const { width, height } = canvas.value.getBoundingClientRect(); lobby?.resize(width, height); };
    observer = new ResizeObserver(fit);
    observer.observe(canvas.value);
    fit();
    lobby.start();
  }
  import('./TrainingView.vue').catch(() => {}); // Router retries the load on navigation.
});
onBeforeUnmount(() => {
  observer?.disconnect();
  lobby?.dispose();
  engine.start();
});

function pick(station) {
  if (lobby) lobby.pickById(station.id);
  else enter(station);
}

function enter(station) {
  return router.push({ name: 'training', query: { act: station.act } });
}
</script>

<template>
  <main class="lobby">
    <canvas
      ref="canvas"
      class="lobby-world"
      :hidden="fallback"
      aria-hidden="true"
    />
    <LobbyHud
      ref="hud"
      :fallback="fallback"
      :active="active"
      @pick="pick"
      @highlight="lobby?.highlight($event)"
    />
  </main>
</template>
