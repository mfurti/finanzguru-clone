import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { defineConfig, devices } from '@playwright/test'
import { E2E_PASSWORD } from './constants'

// Own ports so E2E never collides with a running dev server.
const WEB_PORT = 3200
const API_PORT = 3201
const dataDir = mkdtempSync(join(tmpdir(), 'finance-e2e-'))

const apiEnv = {
  NODE_ENV: 'test',
  PORT: String(API_PORT),
  DATABASE_PATH: join(dataDir, 'app.db'),
  API_SESSION_SECRET: 'e2e-session-secret-0123456789abcdef',
  API_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'),
  COOKIE_SECURE: 'false',
  OWNER_PASSWORD: E2E_PASSWORD,
  // Every E2E project logs in; keep the production limit (5/min) out of the way.
  LOGIN_RATE_LIMIT: '100',
  // Invented local brand only (009 US2); real logos never go into the repository.
  BRAND_LOGOS_DIR: join(import.meta.dirname, 'fixtures', 'local-logos'),
}

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'desktop',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        storageState: 'e2e/.auth/owner.json',
      },
    },
    {
      name: 'mobile',
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 360, height: 780 },
        hasTouch: true,
        storageState: 'e2e/.auth/owner.json',
      },
    },
  ],
  webServer: [
    {
      command:
        'pnpm --filter @finance/shared build && pnpm --filter api build && node apps/api/dist/scripts/seed.js --demo && node apps/api/dist/scripts/set-password.js --name E2E && node apps/api/dist/main.js',
      cwd: '..',
      env: apiEnv,
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: 'pnpm --filter web build && node apps/web/.output/server/index.mjs',
      cwd: '..',
      env: { PORT: String(WEB_PORT), NUXT_API_BASE_URL: `http://localhost:${API_PORT}` },
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
})
