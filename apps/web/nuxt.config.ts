// https://nuxt.com/docs/api/configuration/nuxt-config

/**
 * Production security headers. Nuxt inlines its payload and the color-mode
 * script, so scripts and styles need 'unsafe-inline'; everything else is
 * same-origin only (icons are bundled, API calls go through /api on this host).
 * Dev mode skips them because Vite HMR needs websockets and eval.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ')

const securityHeaders = {
  'Content-Security-Policy': CSP,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
}

export default defineNuxtConfig({
  compatibilityDate: '2026-11-01',
  devtools: { enabled: false },
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  // Fonts come from the bundled @fontsource package (main.css), never from a font provider.
  ui: { fonts: false },
  // Short fade/slide between routes (styles in main.css, off for reduced motion).
  app: {
    pageTransition: { name: 'page', mode: 'out-in' },
  },
  // Components are referenced by file name (AccountFilter, not CommonAccountFilter).
  components: [{ path: '~/components', pathPrefix: false }],
  devServer: {
    port: 3000,
  },
  routeRules: process.env.NODE_ENV === 'production' ? { '/**': { headers: securityHeaders } } : {},
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
  // Pre-bundle ECharts and vue-echarts together in dev, so both use one ECharts copy and the
  // sankey/renderer registered in utils/echarts.ts is the one vue-echarts sees (011).
  vite: {
    optimizeDeps: {
      include: [
        'echarts/core',
        'echarts/charts',
        'echarts/components',
        'echarts/renderers',
        'vue-echarts',
      ],
    },
  },
})
