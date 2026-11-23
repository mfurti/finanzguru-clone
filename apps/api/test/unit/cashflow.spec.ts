import { describe, expect, it } from 'vitest'
import {
  bars,
  type CashflowTx,
  type CategoryInfo,
  categoryTotals,
  sankey,
  totals,
} from '../../src/domain/cashflow'

const categories = new Map<string, CategoryInfo>(
  [
    { id: 'wohnen', parentId: null, name: 'Wohnen', kind: 'expense', color: 'blue' },
    { id: 'miete', parentId: 'wohnen', name: 'Miete / Wohngeld', kind: 'expense', color: 'blue' },
    { id: 'sparen', parentId: null, name: 'Sparen und Anlegen', kind: 'savings', color: 'violet' },
    { id: 'wp', parentId: 'sparen', name: 'Wertpapieranlage', kind: 'savings', color: 'violet' },
    { id: 'einnahmen', parentId: null, name: 'Einnahmen', kind: 'income', color: 'green' },
    { id: 'gehalt', parentId: 'einnahmen', name: 'Gehalt', kind: 'income', color: 'green' },
  ].map((category) => [category.id, category as CategoryInfo]),
)

const tx = (
  bookingDate: string,
  amountCents: number,
  type: CashflowTx['type'],
  categoryId: string | null = null,
) => ({
  bookingDate,
  amountCents,
  type,
  categoryId,
})

const november: CashflowTx[] = [
  tx('2026-11-01', 164401, 'income', 'gehalt'),
  tx('2026-11-03', -75000, 'expense', 'miete'),
  tx('2026-11-05', -5000, 'expense', 'wp'),
  tx('2026-11-06', -97824, 'expense'),
  tx('2026-11-07', -25000, 'transfer'),
]

describe('cash-flow totals', () => {
  it('sums income, expenses, balance, saved and savings rate; ignores transfers', () => {
    expect(totals(november, categories)).toEqual({
      incomeCents: 164401,
      expenseCents: 177824,
      balanceCents: -13423,
      savedCents: 5000,
      savingsRate: '0.030413',
    })
  })

  it('returns a null savings rate without income', () => {
    expect(totals([tx('2026-11-03', -100, 'expense')], categories).savingsRate).toBeNull()
  })
})

describe('bars', () => {
  it('builds 12 monthly bars ending at the anchor and marks the current one', () => {
    const result = bars(november, categories, 'month', '2026-11-15', '2026-11-23')
    expect(result).toHaveLength(12)
    expect(result.at(-1)).toMatchObject({
      label: 'November 2026',
      incomeCents: 164401,
      isCurrent: true,
    })
    expect(result[0]).toMatchObject({ label: 'Dezember 2025', incomeCents: 0, isCurrent: false })
  })
})

describe('category totals', () => {
  it('groups expenses by main category with sub categories and an uncategorized bucket', () => {
    const result = categoryTotals(november, categories, 'expense')
    expect(result.totalCents).toBe(177824)
    expect(result.count).toBe(3)
    expect(result.items.map((item) => [item.name, item.totalCents])).toEqual([
      ['Nicht kategorisiert', 97824],
      ['Wohnen', 75000],
      ['Sparen und Anlegen', 5000],
    ])
    expect(result.items[1]?.children).toEqual([
      expect.objectContaining({ name: 'Miete / Wohngeld', totalCents: 75000, count: 1 }),
    ])
  })
})

describe('sankey', () => {
  it('links income to main and sub categories', () => {
    const graph = sankey(november, categories)
    expect(graph.links).toContainEqual({
      source: 'income',
      target: 'main:wohnen',
      valueCents: 75000,
    })
    expect(graph.links).toContainEqual({
      source: 'main:wohnen',
      target: 'sub:miete',
      valueCents: 75000,
    })
    expect(graph.nodes.find((node) => node.id === 'rest')).toBeUndefined()
    const fromIncome = graph.links.filter((link) => link.source === 'income')
    expect(fromIncome.reduce((sum, link) => sum + link.valueCents, 0)).toBe(177824)
  })

  it('adds the unspent rest when income exceeds expenses', () => {
    const graph = sankey(
      [tx('2026-11-01', 1000, 'income'), tx('2026-11-02', -400, 'expense')],
      categories,
    )
    expect(graph.links).toContainEqual({ source: 'income', target: 'rest', valueCents: 600 })
  })
})
