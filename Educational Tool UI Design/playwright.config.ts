import { defineConfig, devices } from '@playwright/test'

// Development exposes the read-only state hook. Separate production preview verifies CSP
// and the absence of that hook without weakening the shipped production bundle.
// PW_DEV_PORT/PW_PREVIEW_PORT let parallel worktrees run E2E without reusing each other's servers.
export const DEV_PORT = Number(process.env.PW_DEV_PORT ?? 4174)
export const PREVIEW_PORT = Number(process.env.PW_PREVIEW_PORT ?? 4173)
export const DEV_URL = `http://127.0.0.1:${DEV_PORT}`
export const PREVIEW_URL = `http://127.0.0.1:${PREVIEW_PORT}`

export default defineConfig({
  timeout: 60_000, // Complete flows include software WebGL, navigation and axe audits.
  testDir: './e2e', fullyParallel: true, forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: DEV_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure', launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'] } },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: `pnpm exec vite --host 127.0.0.1 --port ${DEV_PORT} --strictPort`, env: { PORT: String(DEV_PORT), FIGMA_DEV_SERVER_HOST: '127.0.0.1' }, url: DEV_URL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
    { command: `pnpm run build && pnpm run preview -- --host 127.0.0.1 --port ${PREVIEW_PORT}`, env: { PORT: String(PREVIEW_PORT), FIGMA_DEV_SERVER_HOST: '127.0.0.1' }, url: PREVIEW_URL, reuseExistingServer: !process.env.CI, timeout: 120_000 },
  ],
})
