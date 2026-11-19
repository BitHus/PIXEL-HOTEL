import { defineConfig } from '@playwright/test';
// PB_URL=https://pocketbarrel.com npx playwright test -c e2e/run11live.config.ts --project=desktop
export default defineConfig({
  testDir: '.', testMatch: /run11live\.spec\.ts/, outputDir: '../test-results-r11', workers: 1, timeout: 480000,
  use: { baseURL: process.env.PB_URL ?? 'https://pocketbarrel.com' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
