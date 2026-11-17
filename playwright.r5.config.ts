import { defineConfig } from '@playwright/test';
// Smoke tests run against the production build (vite preview), as the tester found dev reloads flaky.
export default defineConfig({
  testDir: 'e2e',
  outputDir: 'test-results/_pw',
  workers: 2, // the tavern route is timing based: 8 parallel browsers starve each other
  use: { baseURL: 'http://localhost:4182', screenshot: 'only-on-failure', actionTimeout: 5000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
  webServer: { command: 'cd client && npx vite preview --outDir C:/Users/ajren/AppData/Local/Temp/r5dist --port 4182', url: 'http://localhost:4182', reuseExistingServer: false, timeout: 180000 },
});
