import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [svelte()],
  server: { port: 47619, strictPort: true },
  preview: { port: 47619, strictPort: true },
  build: { sourcemap: false, chunkSizeWarningLimit: 2000 },
});
