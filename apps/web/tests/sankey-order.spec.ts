import { describe, expect, it } from 'vitest'
import { sankeyOrder } from '~/utils/sankey-order'

const nodes = [
  { id: 'income', label: 'Einnahmen', kind: 'income' as const },
  { id: 'leben', label: 'Lebenshaltung', kind: 'main' as const },
  { id: 'wohnen', label: 'Wohnen', kind: 'main' as const },
  { id: 'saldo', label: 'Gespart', kind: 'balance' as const },
  { id: 'strom', label: 'Strom', kind: 'sub' as const },
  { id: 'essen', label: 'Lebensmittel', kind: 'sub' as const },
  { id: 'miete', label: 'Miete', kind: 'sub' as const },
  { id: 'handy', label: 'Handy', kind: 'sub' as const },
]
const links = [
  { source: 'income', target: 'leben', value: 500 },
  { source: 'income', target: 'wohnen', value: 900 },
  { source: 'income', target: 'saldo', value: 2000 },
  { source: 'wohnen', target: 'strom', value: 50 },
  { source: 'wohnen', target: 'miete', value: 850 },
  { source: 'leben', target: 'essen', value: 450 },
  { source: 'leben', target: 'handy', value: 50 },
]

const ordered = (ids: string[], rank: Map<string, number>) =>
  [...ids].sort((a, b) => rank.get(a)! - rank.get(b)!)

describe('sankeyOrder', () => {
  it('sorts main categories by amount with the balance last', () => {
    const { rank } = sankeyOrder(nodes, links)
    expect(ordered(['leben', 'wohnen', 'saldo'], rank)).toEqual(['wohnen', 'leben', 'saldo'])
  })

  it('groups sub categories under their main category in the same order', () => {
    const { rank, group } = sankeyOrder(nodes, links)
    expect(ordered(['strom', 'essen', 'miete', 'handy'], rank)).toEqual([
      'miete',
      'strom',
      'essen',
      'handy',
    ])
    expect(group.get('miete')).toBe('wohnen')
    expect(group.get('handy')).toBe('leben')
  })

  it('produces no crossing links between the middle and the right column', () => {
    const { rank } = sankeyOrder(nodes, links)
    const middle = links.filter((l) => l.source !== 'income')
    for (const a of middle) {
      for (const b of middle) {
        const sourceOrder = rank.get(a.source)! - rank.get(b.source)!
        const targetOrder = rank.get(a.target)! - rank.get(b.target)!
        // Two links cross when their sources and targets are in opposite order.
        expect(sourceOrder * targetOrder).toBeGreaterThanOrEqual(0)
      }
    }
  })
})
