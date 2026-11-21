import { defineConfig } from '@playwright/test';
// PB_URL=http://localhost:4276 npx playwright test -c e2e/run16.config.ts --project=desktop
export default defineConfig({
  testDir: '.', testMatch: /run16[bc]?\.spec\.ts/, outputDir: '../test-results-r16', workers: 1, timeout: 900000,
  use: { baseURL: process.env.PB_URL ?? 'http://localhost:4276' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
