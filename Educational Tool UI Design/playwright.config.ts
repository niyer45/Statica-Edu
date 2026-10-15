import { defineConfig, devices } from '@playwright/test'

// Fixed preview port for E2E; distinct from the Figma Make dev server ($PORT, default 8443).
const PORT = 4173
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // vite.config.ts reads PORT for preview; host is pinned to loopback for tests.
    command: 'pnpm run build && pnpm run preview',
    env: { PORT: String(PORT), FIGMA_DEV_SERVER_HOST: '127.0.0.1' },
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
