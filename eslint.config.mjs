// Root flat config: Nuxt rules for apps/web, typescript-eslint for api and shared.
import { createConfigForNuxt } from '@nuxt/eslint-config/flat'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default createConfigForNuxt({
  features: {
    tooling: true,
    stylistic: false,
  },
  dirs: {
    src: ['./apps/web', './apps/web/app'],
  },
})
  .prepend({
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.nuxt/**',
      '**/.output/**',
      '**/*.min.js',
      'playwright-report/**',
      'test-results/**',
      'specs/**',
      '.specify/**',
      '.claude/**',
    ],
  })
  .append({
    files: ['apps/api/**/*.ts', 'packages/shared/**/*.ts'],
    rules: {
      ...tseslint.configs.recommended.at(-1)?.rules,
      '@typescript-eslint/consistent-type-imports': 'off',
      // Nest modules are decorated empty classes by design.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
    },
  })
  .append(prettier)
