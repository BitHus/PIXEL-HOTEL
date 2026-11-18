import { defineConfig } from '@playwright/test';
// Run 9: serve a build on 4230 (vite preview --outDir <dist> --port 4230), then npx playwright test -c e2e/run9.config.ts
export default defineConfig({
  testDir: '.', testMatch: /run9\.spec\.ts/, outputDir: '../test-results-r9',
  use: { baseURL: 'http://localhost:4230' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
});
