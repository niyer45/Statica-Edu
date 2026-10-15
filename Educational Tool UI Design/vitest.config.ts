import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// Reuses vite.config.ts (plugins and the `@` alias) and layers test settings on top.
export default defineConfig((configEnv) =>
  mergeConfig(
    viteConfig(configEnv),
    defineConfig({
      test: {
        passWithNoTests: true,
        exclude: ['**/node_modules/**', 'dist/**', 'e2e/**'],
        projects: [
          {
            extends: true,
            test: {
              name: 'node',
              environment: 'node',
              include: ['src/**/*.test.{ts,tsx}', 'test/**/*.test.{ts,tsx}'],
              exclude: ['src/ui/**'],
            },
          },
          {
            extends: true,
            test: {
              name: 'ui',
              environment: 'jsdom',
              include: ['src/ui/**/*.test.{ts,tsx}'],
            },
          },
        ],
        coverage: {
          provider: 'v8',
          include: ['src/**/*.{ts,tsx}'],
          exclude: ['src/**/*.test.{ts,tsx}', 'src/vite-env.d.ts'],
          // Glob-keyed thresholds apply only to files matching each directory,
          // so they are inert until those directories contain source files.
          thresholds: {
            'src/physics/**': { lines: 95 },
            'src/geometry/**': { lines: 95 },
            'src/evaluation/**': { lines: 95 },
            'src/state/**': { lines: 95 },
          },
        },
      },
    }),
  ),
)
