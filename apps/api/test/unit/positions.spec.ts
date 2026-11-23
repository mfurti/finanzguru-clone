import { describe, expect, it } from 'vitest'
import { computePositions, type PositionTx, summarize } from '../../src/domain/positions'

const tx = (
  overrides: Partial<PositionTx> & Pick<PositionTx, 'type' | 'bookingDate'>,
): PositionTx => ({
  instrumentId: 'etf',
  quantity: null,
  unitPrice: null,
  amountCents: 0,
  feeCents: 0,
  taxCents: 0,
  ...overrides,
})

describe('FIFO positions', () => {
  const trades = [
    tx({
      type: 'buy',
      bookingDate: '2026-01-10',
      quantity: '10',
      unitPrice: '100',
      amountCents: -100100,
      feeCents: 100,
    }),
    tx({
      type: 'buy',
      bookingDate: '2026-02-10',
      quantity: '5',
      unitPrice: '110',
      amountCents: -55000,
    }),
    tx({
      type: 'sell',
      bookingDate: '2026-03-10',
      quantity: '12',
      unitPrice: '120',
      amountCents: 143900,
      feeCents: 100,
    }),
  ]

  it('consumes the oldest lots first and books realized gains', () => {
    const summary = summarize(computePositions(trades).get('etf')!)
    // cost: lot 1 = 10 × 100 + 1 € fee = 1001 €, 2 units of lot 2 = 220 € → 1221 €
    // proceeds 12 × 120 = 1440 € → gross 219 €, net 218 € after the 1 € sell fee
    expect(summary.realizedGrossCents).toBe(21900)
    expect(summary.realizedNetCents).toBe(21800)
    expect(summary.quantity).toBe('3')
    expect(summary.investedCents).toBe(33000)
    expect(summary.avgPrice).toBe('110')
    expect(summary.sold).toBe(false)
  })

  it('sorts by booking date before applying', () => {
    const shuffled = [trades[2]!, trades[0]!, trades[1]!]
    expect(summarize(computePositions(shuffled).get('etf')!).realizedGrossCents).toBe(21900)
  })

  it('handles partial sells within one lot', () => {
    const summary = summarize(
      computePositions([
        tx({
          type: 'buy',
          bookingDate: '2026-01-01',
          quantity: '13.26',
          unitPrice: '110.63',
          amountCents: 0,
        }),
        tx({
          type: 'sell',
          bookingDate: '2026-02-01',
          quantity: '3.26',
          unitPrice: '120',
          amountCents: 0,
        }),
      ]).get('etf')!,
    )
    expect(summary.quantity).toBe('10')
    expect(summary.investedCents).toBe(110630)
  })

  it('marks fully sold positions', () => {
    const summary = summarize(
      computePositions([
        tx({ type: 'buy', bookingDate: '2026-01-01', quantity: '2', unitPrice: '50' }),
        tx({ type: 'sell', bookingDate: '2026-02-01', quantity: '2', unitPrice: '40' }),
      ]).get('etf')!,
    )
    expect(summary.sold).toBe(true)
    expect(summary.realizedGrossCents).toBe(-2000)
    expect(summary.avgPrice).toBeNull()
  })

  it('applies splits to open lots without changing cost', () => {
    const summary = summarize(
      computePositions([
        tx({ type: 'buy', bookingDate: '2026-01-01', quantity: '10', unitPrice: '100' }),
        tx({ type: 'split', bookingDate: '2026-02-01', quantity: '2' }),
      ]).get('etf')!,
    )
    expect(summary.quantity).toBe('20')
    expect(summary.investedCents).toBe(100000)
    expect(summary.avgPrice).toBe('50')
  })

  it('collects dividends', () => {
    const summary = summarize(
      computePositions([
        tx({ type: 'buy', bookingDate: '2026-01-01', quantity: '10', unitPrice: '100' }),
        tx({ type: 'dividend', bookingDate: '2026-06-01', amountCents: 1234 }),
      ]).get('etf')!,
    )
    expect(summary.dividendsCents).toBe(1234)
  })

  it('rejects selling more than is open', () => {
    expect(() =>
      computePositions([
        tx({ type: 'buy', bookingDate: '2026-01-01', quantity: '1', unitPrice: '10' }),
        tx({ type: 'sell', bookingDate: '2026-01-02', quantity: '2', unitPrice: '10' }),
      ]),
    ).toThrow(/exceeds open quantity/)
  })
})
