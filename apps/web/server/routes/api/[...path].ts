import { joinURL } from 'ufo'

/**
 * Forwards every /api/** request to the NestJS API so the browser stays on one
 * origin (session cookie without CORS). The target comes from runtime config,
 * so containers can set NUXT_API_BASE_URL without rebuilding.
 */
export default defineEventHandler((event) => {
  const { apiBaseUrl } = useRuntimeConfig(event)
  const target = joinURL(apiBaseUrl, event.path)
  return proxyRequest(event, target)
})
