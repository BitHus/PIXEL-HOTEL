import { defineConfig } from '@playwright/test';
// Run 10: serve a build on 4240 (vite preview --outDir <dist> --port 4240), then npx playwright test -c e2e/run10.config.ts [spec]
export default defineConfig({
  testDir: '.', testMatch: /(run6\w*|run7|run8|run9|run10|guide|hints|hats|smoke|boot|farm|stack|mg3dig)\.spec\.ts/, outputDir: '../test-results-r10', workers: 1, timeout: 120000,
  use: { baseURL: 'http://localhost:4240' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
