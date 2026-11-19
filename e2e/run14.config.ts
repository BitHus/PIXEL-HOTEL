import { defineConfig } from '@playwright/test';
// PB_URL=http://localhost:4263 npx playwright test -c e2e/run14.config.ts --project=desktop
export default defineConfig({
  testDir: '.', testMatch: /run14\.spec\.ts/, outputDir: '../test-results-r14', workers: 1, timeout: 600000,
  use: { baseURL: process.env.PB_URL ?? 'http://localhost:4263' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
