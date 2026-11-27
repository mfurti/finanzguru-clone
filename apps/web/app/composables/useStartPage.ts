import type { OwnerSettings } from '@finance/shared'

/** Path of each start page choice (014 Anzeige). */
export const START_PAGE_PATHS: Record<OwnerSettings['startPage'], string> = {
  dashboard: '/',
  transactions: '/transactions',
  budget: '/budget',
}

/**
 * Where the first visit of `/` goes: the owner's start page. Only the first navigation of the
 * app counts, so the Übersicht stays reachable afterwards.
 */
export function startPageRedirect(path: string, startPage: OwnerSettings['startPage']) {
  return path === '/' && startPage !== 'dashboard' ? START_PAGE_PATHS[startPage] : null
}
