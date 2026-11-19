<script setup>
// The shell shared by pages: the .app grid with the top bar, the current page, and the slide-over panel beside it.
// .app is a CSS grid that places its direct children by class, so pages render as fragments (no wrapper element).
import { ref, watch } from 'vue';
import { useSettings } from '../stores/settings.js';
import { provideLayout } from '../composables/useLayout.js';
import TopBar from '../components/TopBar.vue';
import SettingsDrawer from '../components/drawer/SettingsDrawer.vue';

const settings = useSettings();
const drawerOpen = ref(false), topBar = ref(null);
const app = provideLayout().el.app;              // the layout's elements are shared by template refs (useLayout.js)
watch(drawerOpen, v => { if (!v && topBar.value) topBar.value.focus(); });
</script>

<template>
  <link
    rel="stylesheet"
    href="https://fonts.googleapis.com/css2?family=Unbounded:wght@400;500;600&family=Inter:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&display=swap"
  >
  <div
    ref="app"
    class="app"
    :style="{ '--cl': settings.layout.cl ? settings.layout.cl + 'px' : null, '--cr': settings.layout.cr ? settings.layout.cr + 'px' : null }"
  >
    <TopBar
      ref="topBar"
      :drawer-open="drawerOpen"
      @toggle-drawer="drawerOpen = !drawerOpen"
    />
    <RouterView />
  </div>
  <SettingsDrawer v-model:open="drawerOpen" />
</template>
