import { defineConfig } from '@playwright/test';
// PB_URL=http://localhost:4252 npx playwright test -c e2e/run12.config.ts --project=desktop -g "name"
export default defineConfig({
  testDir: '.', testMatch: /(run12|_probe12)\.spec\.ts/, outputDir: '../test-results-r12', workers: 1, timeout: 480000,
  use: { baseURL: process.env.PB_URL ?? 'http://localhost:4252' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
