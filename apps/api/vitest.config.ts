import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

// SWC keeps decorator metadata, which Nest's DI needs at test time.
const plugins = [swc.vite({ module: { type: 'es6' } })]

export default defineConfig({
  test: {
    projects: [
      {
        plugins,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['test/unit/**/*.spec.ts'],
        },
      },
      {
        plugins,
        test: {
          name: 'e2e',
          environment: 'node',
          include: ['test/e2e/**/*.e2e-spec.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
})
