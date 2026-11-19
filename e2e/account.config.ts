import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: /account\.spec\.ts/, workers: 1, timeout: 120000,
  use: { baseURL: 'http://localhost:4250', viewport: { width: 1000, height: 700 } },
  projects: [{ name: 'desktop' }],
});
