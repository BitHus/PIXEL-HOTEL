import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'C:/Users/ajren/PIXEL-HOTEL/e2e',
  testMatch: /run5fix\.spec\.ts/,
  outputDir: 'C:/Users/ajren/PIXEL-HOTEL/test-results/_pwfix',
  workers: 2,
  use: { baseURL: 'http://localhost:4191', screenshot: 'only-on-failure', actionTimeout: 5000 },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1000, height: 700 } } },
    { name: 'phone', use: { viewport: { width: 420, height: 760 }, deviceScaleFactor: 2, hasTouch: true } },
  ],
  webServer: { command: 'cd C:/Users/ajren/PIXEL-HOTEL/client && npx vite preview --outDir C:/Users/ajren/AppData/Local/Temp/claude/fcfc15d6e21e5da9/58290611-1489-4cef-91a1-006b4f8e9977/scratchpad/dist --port 4191', url: 'http://localhost:4191', reuseExistingServer: false, timeout: 180000 },
});
