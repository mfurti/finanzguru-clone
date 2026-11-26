import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  berlinDate,
  mapScalable,
  type PortfolioData,
} from '../../src/modules/sources/scalable-mcp/mapper'

/** Anonymized real responses recorded on 2026-11-24 (004 T006). */
const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(__dirname, '../fixtures/scalable-mcp', `${name}.json`), 'utf8')) as T

function data(): PortfolioData[] {
  const { portfolios } = fixture<{ portfolios: PortfolioData['portfolio'][] }>(
    'list_accessible_portfolios',
  )
  const page1 = fixture<{ transactions: PortfolioData['transactions'] }>(
    'list_portfolio_transactions.page1',
  )
  const page2 = fixture<{ transactions: PortfolioData['transactions'] }>(
    'list_portfolio_transactions.page2',
  )
  return [
    {
      portfolio: portfolios[0]!,
      holdings: fixture<{ holdings: PortfolioData['holdings'] }>('get_portfolio_holdings').holdings,
      cash: fixture<PortfolioData['cash']>('get_portfolio_cash_breakdown'),
      transactions: [...page1.transactions, ...page2.transactions],
    },
  ]
}

describe('Scalable mapper (004 T007, recorded responses)', () => {
  it('creates the depot and its reference account with the cash balance', () => {
    const batch = mapScalable(data())
    expect(batch.accounts.map((a) => [a.externalRef, a.type])).toEqual([
      ['scalable-depot', 'depot'],
      ['scalable-cash', 'reference'],
    ])
    const cash = fixture<{ cash: { cashBalance: number } }>('get_portfolio_cash_breakdown')
    expect(batch.accounts[1]!.balanceCents).toBe(Math.round(cash.cash.cashBalance * 100))
    expect(batch.accounts[1]!.parentExternalRef).toBe('scalable-depot')
  })

  it('maps every settled booking: securities to the depot, cash to the reference account', () => {
    const input = data()
    const batch = mapScalable(input)
    expect(batch.rowErrors).toEqual([])
    // A cancellation drops itself and the booking it reverses.
    const all = input[0]!.transactions
    const cancellation = all.find((t) => t.isCancellation)!
    const settled = all.filter(
      (t) => t.status === 'SETTLED' && !t.isCancellation && Number(t.cash?.amount ?? 1) !== 0,
    )
    expect(batch.transactions).toHaveLength(settled.length - 1)
    const refs = batch.transactions.map((t) => t.sourceRef)
    const original = all.find(
      (t) =>
        !t.isCancellation &&
        t.lastEventAt === cancellation.lastEventAt &&
        t.security?.isin === cancellation.security?.isin,
    )!
    expect(refs).not.toContain(original.id)
    for (const tx of batch.transactions) {
      expect(tx.sourceRef).toMatch(/^tx-\d{3}$/)
      expect(tx.bookingDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      if (tx.type === 'buy' || tx.type === 'sell') {
        expect(tx.accountExternalRef).toBe('scalable-depot')
        expect(tx.isin).toMatch(/^[A-Z]{2}[A-Z0-9]{9}\d$/)
        expect(Number(tx.quantity)).toBeGreaterThan(0)
        expect(Math.sign(tx.amountCents)).toBe(tx.type === 'buy' ? -1 : 1)
      } else if (tx.type === 'dividend') {
        expect(tx.accountExternalRef).toBe('scalable-depot')
        expect(tx.amountCents).toBeGreaterThan(0)
      } else {
        expect(tx.accountExternalRef).toBe('scalable-cash')
        expect(['deposit', 'withdrawal', 'fee', 'interest', 'tax']).toContain(tx.type)
        if (tx.type === 'deposit' || tx.type === 'interest')
          expect(tx.amountCents).toBeGreaterThan(0)
        if (tx.type === 'withdrawal' || tx.type === 'fee') expect(tx.amountCents).toBeLessThan(0)
      }
    }
    expect(batch.transactions.some((t) => t.purpose === 'Depotübertrag (eingehend)')).toBe(true)
  })

  it('reports the held positions and current prices', () => {
    const batch = mapScalable(data())
    const holding = fixture<{ holdings: { isin: string; position: { filled: number } }[] }>(
      'get_portfolio_holdings',
    ).holdings[0]!
    expect(batch.positionsSnapshot).toEqual([
      {
        accountExternalRef: 'scalable-depot',
        isin: holding.isin,
        quantity: String(holding.position.filled),
      },
    ])
    expect(batch.prices.map((p) => p.isin)).toContain(holding.isin)
    expect(batch.instruments.find((i) => i.isin === holding.isin)!.assetClass).toBe('etf')
  })

  it('skips pending and cancelled bookings and rejects foreign currencies', () => {
    const [portfolio] = data()
    const base = portfolio!.transactions[0]!
    const batch = mapScalable([
      {
        ...portfolio!,
        transactions: [
          { ...base, id: 'p1', status: 'PENDING' },
          { ...base, id: 'c1', isCancellation: true },
          { ...base, id: 'usd', currency: 'USD' },
        ],
      },
    ])
    expect(batch.transactions).toEqual([])
    expect(batch.rowErrors).toEqual([{ reason: 'unknown_currency_no_rate:usd' }])
  })

  it('keeps a second portfolio apart with its own refs', () => {
    const [portfolio] = data()
    const batch = mapScalable([
      portfolio!,
      { ...portfolio!, portfolio: { portfolioId: 'pf-002', displayName: 'Zweites Depot' } },
    ])
    expect(batch.accounts.map((a) => a.externalRef)).toContain('scalable-depot:pf-002')
    expect(batch.accounts.find((a) => a.externalRef === 'scalable-depot:pf-002')!.name).toBe(
      'Scalable Capital Depot (Zweites Depot)',
    )
  })

  it('books by the date in Germany', () => {
    expect(berlinDate('2026-03-31T22:30:00Z')).toBe('2026-04-01')
    expect(berlinDate('2026-07-01T21:59:00Z')).toBe('2026-07-01')
  })
})
