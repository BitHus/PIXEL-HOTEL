import { defineConfig } from '@playwright/test';
// Run 7: node_modules/.bin/playwright test -c e2e/run7.config.ts  (preview of the built tree on 4210)
export default defineConfig({
  testDir: '.', testMatch: /run7.*\.spec\.ts/, outputDir: '../test-results-r7',
  use: { baseURL: 'http://localhost:4210' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
  webServer: { command: 'npm run preview -w client -- --port 4210', url: 'http://localhost:4210', reuseExistingServer: true, timeout: 60000 },
});
