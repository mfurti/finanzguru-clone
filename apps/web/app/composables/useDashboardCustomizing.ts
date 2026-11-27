/**
 * Open state of the dashboard "Anpassen" window. The button lives in the Übersicht frame
 * (layouts/overview.vue, 012 P3) and the window on the dashboard page, so both share it.
 */
export function useDashboardCustomizing() {
  return useState<boolean>('dashboard-customizing', () => false)
}
