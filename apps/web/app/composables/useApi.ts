import type { UseFetchOptions } from '#app'

/**
 * Typed wrapper around useFetch for `/api/**`. On the server it goes through
 * useRequestFetch, so the session cookie is forwarded to the API proxy.
 * A 401 sends the user to the login page.
 */
export function useApi<T>(
  path: string | Ref<string> | (() => string),
  options: UseFetchOptions<T> = {},
) {
  const requestFetch = useRequestFetch()
  return useFetch(path, {
    ...options,
    $fetch: requestFetch as typeof $fetch,
    onResponseError(context) {
      if (context.response.status === 401) void redirectToLogin()
      const hook = options.onResponseError
      if (typeof hook === 'function') return hook(context)
    },
  })
}

/** Imperative calls (forms, mutations). Throws FetchError on failure. */
export function apiFetch<T>(path: string, options: Parameters<typeof $fetch>[1] = {}) {
  return $fetch<T>(path, {
    ...options,
    async onResponseError(context) {
      if (context.response.status === 401) await redirectToLogin()
    },
  })
}

async function redirectToLogin(): Promise<void> {
  const route = useRoute()
  if (route.path === '/login') return
  await navigateTo({ path: '/login', query: { redirect: route.fullPath } })
}
