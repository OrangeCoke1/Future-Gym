import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// poster/ is a separate static site with classic scripts; it is not bundled, just copied into the build as-is
const copyPoster = () => ({
  name: 'copy-poster',
  apply: 'build',
  closeBundle() {
    cpSync(fileURLToPath(new URL('./poster', import.meta.url)), fileURLToPath(new URL('./dist/poster', import.meta.url)), { recursive: true });
  },
});

export default defineConfig({
  plugins: [vue(), copyPoster()],
  server: { port: 8000, strictPort: true },       // poster/bake-figure-a.ps1 expects localhost:8000
  optimizeDeps: { include: ['three'] },           // pre-bundle up front: a mid-load re-optimise reloads the page and aborts the model fetch
  preview: { port: 8000, strictPort: true },
  build: { rollupOptions: { output: { manualChunks: { three: ['three'] } } } },   // three.js in its own file, cached across app changes
});
