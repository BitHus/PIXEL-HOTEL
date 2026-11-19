import { defineConfig } from '@playwright/test';
// PB_URL=http://localhost:4253 npx playwright test -c e2e/run13.config.ts --project=desktop -g "name"
export default defineConfig({
  testDir: '.', testMatch: /run13\.spec\.ts/, outputDir: '../test-results-r13', workers: 1, timeout: 480000,
  use: { baseURL: process.env.PB_URL ?? 'http://localhost:4253' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
