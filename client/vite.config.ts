import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs on any web address.
  base: './',
  server: { host: true },
});
