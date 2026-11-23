import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC keeps decorator metadata, which Nest's DI needs at test time.
const plugins = [swc.vite({ module: { type: 'es6' } })]

// Set before any module is imported: ConfigModule.forRoot() reads env at import time.
const env = {
  NODE_ENV: 'test',
  DATABASE_PATH: ':memory:',
  API_SESSION_SECRET: 'test-session-secret-0123456789abcdef',
  API_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  COOKIE_SECURE: 'false',
}

export default defineConfig({
  test: {
    projects: [
      {
        plugins,
        test: {
          name: 'unit',
          environment: 'node',
          env,
          include: ['test/unit/**/*.spec.ts'],
        },
      },
      {
        plugins,
        test: {
          name: 'e2e',
          environment: 'node',
          env,
          include: ['test/e2e/**/*.e2e-spec.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
})
