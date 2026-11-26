import { describe, expect, it } from 'vitest'
import type { PositionTx } from '../../src/domain/positions'
import {
  computeCashSnapshots,
  computeDepotSnapshots,
  type PriceSeries,
  referenceCashTxs,
} from '../../src/domain/snapshots'

const buy = (
  bookingDate: string,
  quantity: string,
  unitPrice: string,
  feeCents = 0,
): PositionTx => ({
  bookingDate,
  type: 'buy',
  instrumentId: 'etf',
  quantity,
  unitPrice,
  amountCents: 0,
  feeCents,
  taxCents: 0,
})

describe('depot snapshots', () => {
  const prices: PriceSeries = new Map([
    [
      'etf',
      [
        { date: '2026-01-02', close: '100' },
        { date: '2026-01-05', close: '105' },
      ],
    ],
  ])

  it('values open lots at the last known close and tracks flows', () => {
    const rows = computeDepotSnapshots(
      'depot',
      [buy('2026-01-02', '10', '100', 100)],
      prices,
      '2026-01-01',
      '2026-01-06',
    )
    expect(rows.map((row) => row.valueCents)).toEqual([0, 100000, 100000, 100000, 105000, 105000])
    expect(rows[1]).toMatchObject({ investedCents: 100100, externalFlowCents: 100100 })
    expect(rows[2]?.externalFlowCents).toBe(0)
  })

  it('applies transactions before the range to the opening state', () => {
    const rows = computeDepotSnapshots(
      'depot',
      [buy('2026-01-02', '10', '100')],
      prices,
      '2026-01-05',
      '2026-01-05',
    )
    expect(rows).toEqual([
      {
        accountId: 'depot',
        date: '2026-01-05',
        valueCents: 105000,
        investedCents: 100000,
        externalFlowCents: 0,
        priceStale: false,
      },
    ])
  })

  it('flags prices carried forward for more than 4 days as stale', () => {
    const rows = computeDepotSnapshots(
      'depot',
      [buy('2026-01-02', '1', '100')],
      prices,
      '2026-01-09',
      '2026-01-10',
    )
    expect(rows.map((row) => row.priceStale)).toEqual([false, true])
    expect(rows[1]?.valueCents).toBe(10500)
  })

  it('falls back to the trade price when no close exists', () => {
    const rows = computeDepotSnapshots(
      'depot',
      [{ ...buy('2026-01-02', '2', '50'), instrumentId: 'stock' }],
      prices,
      '2026-01-02',
      '2026-01-02',
    )
    expect(rows[0]).toMatchObject({ valueCents: 10000, priceStale: true })
  })
})

describe('cash snapshots', () => {
  it('derives daily balances backwards from the current balance', () => {
    const rows = computeCashSnapshots(
      'giro',
      23737,
      [
        { bookingDate: '2026-11-01', amountCents: 164401 },
        { bookingDate: '2026-11-03', amountCents: -84500 },
        { bookingDate: '2026-11-10', amountCents: -1000 },
      ],
      '2026-11-01',
      '2026-11-03',
    )
    // 23737 now; the 10.11. booking is after the range → end of 03.11. = 24737
    expect(rows.map((row) => row.valueCents)).toEqual([109237, 109237, 24737])
    expect(rows.map((row) => row.externalFlowCents)).toEqual([164401, 0, -84500])
  })
})

describe('broker reference account (010 T003)', () => {
  const own = [{ bookingDate: '2026-11-01', amountCents: 100000, type: 'deposit' }]
  const depot = [
    { bookingDate: '2026-11-01', amountCents: -100000, type: 'buy' },
    { bookingDate: '2026-11-05', amountCents: 110000, type: 'sell' },
    { bookingDate: '2026-11-07', amountCents: -110000, type: 'buy' },
    { bookingDate: '2026-11-08', amountCents: 25, type: 'interest' },
    { bookingDate: '2026-11-08', amountCents: 0, type: 'transfer' },
  ]

  it('adds the depot cash legs, so sale proceeds stay in the value between sell and re-buy', () => {
    const txs = referenceCashTxs(own, depot)
    expect(txs).toHaveLength(5)
    // Today's balance is 25 (the interest); the proceeds sit on the account on 05. and 06.
    const rows = computeCashSnapshots('ref', 25, txs, '2026-11-04', '2026-11-08')
    expect(rows.map((row) => row.valueCents)).toEqual([0, 110000, 110000, 0, 25])
  })

  it('keeps own trade bookings as they are (legs already booked there)', () => {
    const withTrades = [...own, { bookingDate: '2026-11-05', amountCents: 110000, type: 'sell' }]
    expect(referenceCashTxs(withTrades, depot)).toHaveLength(2)
  })
})
