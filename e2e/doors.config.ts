import { defineConfig } from '@playwright/test';
// Owner bug 19 Nov 'all doors do nothing': PB_URL=http://localhost:4262 npx playwright test -c e2e/doors.config.ts
export default defineConfig({
  testDir: '.', testMatch: /doors\.spec\.ts/, outputDir: '../test-results-doors', workers: 1, timeout: 240000,
  use: { baseURL: process.env.PB_URL ?? 'http://localhost:4262' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
