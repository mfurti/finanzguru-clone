/**
 * Crossing-free order for the cash-flow Sankey (income → main → sub):
 * main categories by amount (largest on top, the balance node last), sub
 * categories grouped under their main category in the same order and by
 * amount within it. Links follow the same ranks, so no two links cross.
 */
export interface SankeyNodeIn {
  id: string
  label: string
  kind: 'income' | 'main' | 'sub' | 'balance'
}
export interface SankeyLinkIn {
  source: string
  target: string
  value: number
}

export interface SankeyOrder {
  /** Position of each node within its column (lower = higher up). */
  rank: Map<string, number>
  /** Main category (or the node itself) each node belongs to, for colors. */
  group: Map<string, string>
}

export function sankeyOrder(
  nodes: readonly SankeyNodeIn[],
  links: readonly SankeyLinkIn[],
): SankeyOrder {
  const total = new Map<string, number>()
  const parent = new Map<string, string>()
  for (const link of links) {
    total.set(link.target, (total.get(link.target) ?? 0) + link.value)
    parent.set(link.target, link.source)
  }
  const kind = new Map(nodes.map((node) => [node.id, node.kind]))
  const byAmount = (a: string, b: string) => (total.get(b) ?? 0) - (total.get(a) ?? 0)

  const mains = nodes
    .filter((node) => node.kind === 'main' || node.kind === 'balance')
    .map((node) => node.id)
    .sort((a, b) => {
      // Balance ("Gespart"/"Saldo") always at the bottom of its column.
      const balance = Number(kind.get(a) === 'balance') - Number(kind.get(b) === 'balance')
      return balance || byAmount(a, b)
    })

  const rank = new Map<string, number>()
  const group = new Map<string, string>()
  nodes.filter((node) => node.kind === 'income').forEach((node, i) => rank.set(node.id, i))
  mains.forEach((id, i) => {
    rank.set(id, i)
    group.set(id, id)
  })

  let position = 0
  for (const main of mains) {
    const children = nodes
      .filter((node) => node.kind === 'sub' && parent.get(node.id) === main)
      .map((node) => node.id)
      .sort(byAmount)
    for (const child of children) {
      rank.set(child, position++)
      group.set(child, main)
    }
  }
  // Sub nodes without a known parent go last.
  for (const node of nodes) if (!rank.has(node.id)) rank.set(node.id, position++)
  return { rank, group }
}
