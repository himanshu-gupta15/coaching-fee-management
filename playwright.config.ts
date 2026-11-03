import { defineConfig, devices } from '@playwright/test';

const API_PORT = 5097;
const WEB_PORT = 5182;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /parent\.spec\.ts/ },
  ],
  webServer: [
    {
      // Fresh in-memory replica set, seeded on every run.
      command: 'npm --prefix server run dev:memory',
      env: { PORT: String(API_PORT), MEMORY_DB_PERSIST: 'false', DISABLE_RATE_LIMIT: 'true', NODE_ENV: 'development', CLIENT_URL: `http://localhost:${WEB_PORT}` },
      url: `http://localhost:${API_PORT}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
    },
    {
      command: `cd client && npx vite --port ${WEB_PORT} --strictPort`,
      env: { VITE_PROXY_TARGET: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});
