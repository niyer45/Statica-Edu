import { defineConfig, devices } from '@playwright/test'

// Development exposes the read-only state hook. Separate production preview verifies CSP
// and the absence of that hook without weakening the shipped production bundle.
export default defineConfig({
  testDir: './e2e', fullyParallel: true, forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'pnpm exec vite --host 127.0.0.1 --port 4174 --strictPort', env: { PORT: '4174', FIGMA_DEV_SERVER_HOST: '127.0.0.1' }, url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI, timeout: 120_000 },
    { command: 'pnpm run build && pnpm run preview -- --host 127.0.0.1 --port 4173', env: { PORT: '4173', FIGMA_DEV_SERVER_HOST: '127.0.0.1' }, url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
})
