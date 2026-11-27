/**
 * Every page except /login needs the owner session (FR-060).
 * The session check result is cached for the app instance.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === '/login') return

  const session = useState<{ displayName: string } | null>('session', () => null)
  if (!session.value) {
    try {
      session.value = await useRequestFetch()<{ displayName: string }>('/api/auth/session')
    } catch {
      return navigateTo({ path: '/login', query: { redirect: to.fullPath } })
    }
  }
  // Owner settings (014) once per app instance: start page, privacy mode, density, …
  const { settings, load } = useSettings()
  await load()

  // The first page of a visit opens the owner's start page instead of the Übersicht.
  const firstVisit = useState<boolean>('start-page-applied', () => false)
  if (firstVisit.value) return
  firstVisit.value = true
  const target = startPageRedirect(to.path, settings.value.startPage)
  if (target) return navigateTo({ path: target, query: to.query })
})
