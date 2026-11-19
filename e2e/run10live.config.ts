import { defineConfig } from '@playwright/test';
// vite preview --outDir <dist> --port 4240, then npx playwright test -c e2e/run10live.config.ts
export default defineConfig({
  testDir: '.', testMatch: /run10(live|serve)\.spec\.ts/, outputDir: '../test-results-r10b', workers: 1, timeout: 240000,
  use: { baseURL: 'http://localhost:4240' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
