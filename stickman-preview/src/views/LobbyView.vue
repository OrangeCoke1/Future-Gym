<script setup>
import { onMounted, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useEngine } from '../composables/useEngine.js';
import { useLobby } from '../stores/lobby.js';
import LobbyHud from './lobby/LobbyHud.vue';

const router = useRouter();
const { engine } = useEngine();
const visit = useLobby();

onMounted(() => {
  engine.stop();
  visit.introSeen = true;
  import('./TrainingView.vue').catch(() => {}); // Router retries the load on navigation.
});
onBeforeUnmount(() => engine.start());

function enter(station) {
  return router.push({ name: 'training', query: { act: station.act } });
}
</script>

<template>
  <main class="lobby">
    <LobbyHud @pick="enter" />
  </main>
</template>
