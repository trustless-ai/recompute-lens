import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/agent-anchor', testMatch: 'browser.spec.mjs', workers: 1,
  timeout: 60000, fullyParallel: false, forbidOnly: !!process.env.CI,
  use: { browserName: 'chromium', headless: true, baseURL: 'http://127.0.0.1:4173' },
  webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: false },
});
