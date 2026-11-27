import type { RefreshSchedule } from '@finance/shared'

/**
 * Milliseconds until the next automatic refresh (014 US1), or null when it is off.
 * `daily`: next HH:MM local time (tomorrow when already past); `interval`: every n hours
 * counted from now.
 */
export function nextRefreshDelay(schedule: RefreshSchedule, now = new Date()): number | null {
  if (schedule.mode === 'off') return null
  if (schedule.mode === 'interval') return schedule.hours * 60 * 60 * 1000
  const [hour, minute] = schedule.time.split(':').map(Number) as [number, number]
  const next = new Date(now)
  next.setHours(hour, minute, 0, 0)
  if (next <= now) next.setDate(next.getDate() + 1)
  return next.getTime() - now.getTime()
}
