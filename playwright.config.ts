import { defineConfig } from '@playwright/test';
// Smoke tests run against the production build (vite preview), as the tester found dev reloads flaky.
export default defineConfig({
  testDir: 'e2e',
  use: { baseURL: 'http://localhost:4173', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
  webServer: { command: 'npm run build && npm run preview -w client -- --port 4173', url: 'http://localhost:4173', reuseExistingServer: true, timeout: 180000 },
});
