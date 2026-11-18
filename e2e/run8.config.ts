import { defineConfig } from '@playwright/test';
// Run 8: npx playwright test -c e2e/run8.config.ts  (build first; preview on 4220: npm run preview -w client -- --port 4220 --strictPort)
export default defineConfig({
  testDir: '.', testMatch: /run8\.spec\.ts/, outputDir: '../test-results-r8',
  use: { baseURL: 'http://localhost:4220' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
