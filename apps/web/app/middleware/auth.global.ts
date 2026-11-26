/**
 * Every page except /login needs the owner session (FR-060).
 * The session check result is cached for the app instance.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const session = useState<{ displayName: string } | null>('session', () => null)
  if (session.value) return

  try {
    session.value = await useRequestFetch()<{ displayName: string }>('/api/auth/session')
  } catch {
    return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
  }
})
