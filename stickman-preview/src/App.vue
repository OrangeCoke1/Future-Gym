<script setup>
// Empty container: app-wide setup (engine, language), then the current route (AppLayout + a page from views/).
import { useAppSetup } from './composables/useAppSetup.js';

useAppSetup();
</script>

<template>
  <RouterView />
</template>
