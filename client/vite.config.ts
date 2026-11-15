import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths so the build runs on any web address.
  base: './',
  server: { host: true },
  // Sprite PNGs stay real files in dist (no data: URLs): docs/PLAN-SPRITES.md.
  build: { assetsInlineLimit: 0 },
});
