import { describe, expect, it } from 'vitest'
import {
  type DividendBooking,
  dividendFigures,
  dividendsBySecurity,
  isReceived,
} from '../../src/domain/dividends'

const b = (date: string, cents: number, instrumentId = 'vwrl'): DividendBooking => ({
  date,
  cents,
  instrumentId,
})

describe('dividendFigures', () => {
  const bookings = [
    b('2023-03-20', 1000),
    b('2023-09-20', 1000),
    b('2024-03-20', 1500),
    b('2024-09-20', 1500),
    b('2025-03-20', 2000),
    b('2025-11-25', 2000),
    b('2026-03-20', 2500),
    b('2026-09-20', 2500),
    b('2026-12-20', 9999), // after today: ignored
  ]
  const today = '2026-11-20'

  it('sums the last 12 months and the average per month', () => {
    const figures = dividendFigures(bookings, today, null)
    // 2025-11-25 + 2026-03-20 + 2026-09-20
    expect(figures.last12Cents).toBe(7000)
    expect(figures.avgPerMonthCents).toBe(583)
    expect(figures.ytdCents).toBe(5000)
  })

  it('computes yearly totals with the change to the previous year', () => {
    const { years } = dividendFigures(bookings, today, null)
    expect(years).toEqual([
      { year: 2023, cents: 2000, changePct: null },
      { year: 2024, cents: 3000, changePct: '0.5' },
      { year: 2025, cents: 4000, changePct: '0.333333' },
      { year: 2026, cents: 5000, changePct: '0.25' },
    ])
  })

  it('computes CAGR over full years only', () => {
    // (4000 / 2000)^(1/2) − 1
    expect(Number(dividendFigures(bookings, today, null).cagr)).toBeCloseTo(Math.SQRT2 - 1, 6)
    expect(
      dividendFigures([b('2025-03-01', 100), b('2026-03-01', 200)], today, null).cagr,
    ).toBeNull()
  })

  it('computes the yield against the average depot value', () => {
    expect(dividendFigures(bookings, today, 500_000).yieldYtd).toBe('0.01')
    expect(dividendFigures(bookings, today, 0).yieldYtd).toBeNull()
  })
})

describe('dividendsBySecurity', () => {
  it('groups per instrument with shares', () => {
    expect(
      dividendsBySecurity([
        b('2026-01-01', 300, 'a'),
        b('2026-02-01', 100, 'b'),
        b('2026-03-01', 100, 'a'),
      ]),
    ).toEqual([
      { instrumentId: 'a', cents: 400, pct: '0.8' },
      { instrumentId: 'b', cents: 100, pct: '0.2' },
    ])
  })
})

describe('isReceived', () => {
  it('matches the same instrument in the same month', () => {
    const received = [b('2026-03-20', 100, 'a')]
    expect(isReceived(received, 'a', '2026-03-31')).toBe(true)
    expect(isReceived(received, 'a', '2026-04-01')).toBe(false)
    expect(isReceived(received, 'b', '2026-03-20')).toBe(false)
  })
})
