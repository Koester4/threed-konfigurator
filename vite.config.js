import { defineConfig } from 'vite';

export default defineConfig({
  // Relative Pfade, damit der Build in jedem Unterordner einer Webseite läuft
  base: './',
  build: { chunkSizeWarningLimit: 1000 }, // three.js ist allein ~600 kB
});
