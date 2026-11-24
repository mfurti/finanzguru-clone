import { describe, expect, it } from 'vitest'
import { computeInstrumentValues } from '../../src/domain/instrument-values'
import type { PositionTx } from '../../src/domain/positions'
import type { PriceSeries } from '../../src/domain/snapshots'

const tx = (
  instrumentId: string,
  type: 'buy' | 'sell',
  bookingDate: string,
  quantity: string,
  unitPrice: string,
): PositionTx => ({
  bookingDate,
  type,
  instrumentId,
  quantity,
  unitPrice,
  amountCents: 0,
  feeCents: 0,
  taxCents: 0,
})

describe('instrument values (004 US2)', () => {
  const prices: PriceSeries = new Map([
    [
      'etf',
      [
        { date: '2026-01-02', close: '100.333' },
        { date: '2026-01-06', close: '101.777' },
      ],
    ],
    ['stock', [{ date: '2026-01-03', close: '33.335' }]],
  ])
  const txs = [
    tx('etf', 'buy', '2026-01-02', '3', '100'),
    tx('stock', 'buy', '2026-01-03', '7', '33'),
    tx('etf', 'sell', '2026-01-07', '1', '102'),
  ]

  it('adds up to the depot snapshot to the cent every day', () => {
    const { snapshots, holdings } = computeInstrumentValues(
      'depot',
      txs,
      prices,
      '2026-01-01',
      '2026-01-08',
    )
    for (const snapshot of snapshots) {
      const day = holdings.filter((row) => row.date === snapshot.date)
      expect(day.reduce((sum, row) => sum + row.valueCents, 0)).toBe(snapshot.valueCents)
      expect(day.reduce((sum, row) => sum + row.investedCents, 0)).toBe(snapshot.investedCents)
    }
  })

  it('carries the last price forward over gaps and drops sold-out holdings', () => {
    const { holdings } = computeInstrumentValues('depot', txs, prices, '2026-01-01', '2026-01-08')
    const etf = holdings.filter((row) => row.instrumentId === 'etf')
    // 3 × 100.333 = 300.999 € on 2026-01-02 … 2026-01-05 (no new price).
    expect(etf.find((row) => row.date === '2026-01-05')!.valueCents).toBe(30100)
    // After selling 1 on 2026-01-07: 2 × 101.777.
    expect(etf.find((row) => row.date === '2026-01-08')!.valueCents).toBe(20355)
    expect(holdings.some((row) => row.date === '2026-01-01')).toBe(false)
  })
})
