import { describe, expect, it } from 'vitest'
import { nextRefreshDelay } from '../../src/domain/refresh-schedule'

const HOUR = 60 * 60 * 1000

describe('nextRefreshDelay (014 T007)', () => {
  const now = new Date(2026, 10, 27, 5, 30, 0, 0)

  it('is null when the automatic refresh is off', () => {
    expect(nextRefreshDelay({ mode: 'off', time: '06:00', hours: 6 }, now)).toBeNull()
  })

  it('daily: later today, or tomorrow when the time has passed', () => {
    expect(nextRefreshDelay({ mode: 'daily', time: '06:00', hours: 6 }, now)).toBe(HOUR / 2)
    expect(nextRefreshDelay({ mode: 'daily', time: '05:30', hours: 6 }, now)).toBe(24 * HOUR)
    expect(nextRefreshDelay({ mode: 'daily', time: '04:15', hours: 6 }, now)).toBe(
      22 * HOUR + 45 * 60 * 1000,
    )
  })

  it('interval: every n hours from now', () => {
    expect(nextRefreshDelay({ mode: 'interval', time: '06:00', hours: 4 }, now)).toBe(4 * HOUR)
  })
})
