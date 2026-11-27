const DATE_TIME = new Intl.DateTimeFormat('de-DE', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Europe/Berlin',
})

/**
 * Date and time in German time (e.g. "27.11.2026, 18:05"). The zone is fixed, so the server
 * render and the browser show the same text (no hydration mismatch when the server runs in
 * UTC).
 */
export function formatDateTime(iso: string): string {
  return DATE_TIME.format(new Date(iso))
}
