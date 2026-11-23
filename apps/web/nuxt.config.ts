// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  // Components are referenced by file name (AccountFilter, not CommonAccountFilter).
  components: [{ path: '~/components', pathPrefix: false }],
  devServer: {
    port: 3000,
  },
  runtimeConfig: {
    // Server-only. Override at runtime with NUXT_API_BASE_URL (containers).
    apiBaseUrl: process.env.API_BASE_URL ?? 'http://localhost:3001',
  },
  i18n: {
    defaultLocale: 'de',
    strategy: 'no_prefix',
    locales: [{ code: 'de', language: 'de-DE', name: 'Deutsch', file: 'de.json' }],
  },
  typescript: {
    strict: true,
  },
})
