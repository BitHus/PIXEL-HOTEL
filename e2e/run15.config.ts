import { defineConfig } from '@playwright/test';
// PB_URL=http://localhost:4275 npx playwright test -c e2e/run15.config.ts --project=desktop
export default defineConfig({
  testDir: '.', testMatch: /run15b?\.spec\.ts/, outputDir: '../test-results-r15', workers: 1, timeout: 900000,
  use: { baseURL: process.env.PB_URL ?? 'http://localhost:4275' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
