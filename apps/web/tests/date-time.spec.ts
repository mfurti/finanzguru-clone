import { describe, expect, it } from 'vitest'
import { formatDateTime } from '~/utils/date-time'

describe('formatDateTime (014)', () => {
  it('shows German time whatever the server zone is', () => {
    expect(formatDateTime('2026-11-27T17:05:00.000Z')).toBe('27.11.2026, 18:05')
    expect(formatDateTime('2026-07-01T10:00:00.000Z')).toBe('01.07.2026, 12:00')
  })
})
