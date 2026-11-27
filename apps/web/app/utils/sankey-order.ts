/**
 * Crossing-free order for the cash-flow Sankey (income → main → sub):
 * main categories by amount (largest on top, the balance node last), sub
 * categories grouped under their main category in the same order and by
 * amount within it. Links follow the same ranks, so no two links cross.
 */
export interface SankeyNodeIn {
  id: string
  label: string
  kind: 'income' | 'deficit' | 'main' | 'sub' | 'balance'
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

  // Main categories that split into sub categories first, then those without (e.g. "Nicht
  // kategorisiert"), the balance last: every sub block then starts at or below its main
  // block, so no flow bends upwards (012 P11, like the reference).
  const hasSubs = new Set(
    nodes.filter((node) => node.kind === 'sub').map((node) => parent.get(node.id)),
  )
  const group = (id: string) => (kind.get(id) === 'balance' ? 2 : hasSubs.has(id) ? 0 : 1)
  const mains = nodes
    .filter((node) => node.kind === 'main' || node.kind === 'balance')
    .map((node) => node.id)
    .sort((a, b) => group(a) - group(b) || byAmount(a, b))

  const rank = new Map<string, number>()
  const groupOf = new Map<string, string>()
  // Left column: Einnahmen on top, Fehlbetrag (spending beyond income) below it.
  nodes
    .filter((node) => node.kind === 'income' || node.kind === 'deficit')
    .sort((a, b) => Number(a.kind === 'deficit') - Number(b.kind === 'deficit'))
    .forEach((node, i) => rank.set(node.id, i))
  mains.forEach((id, i) => {
    rank.set(id, i)
    groupOf.set(id, id)
  })

  let position = 0
  for (const main of mains) {
    const children = nodes
      .filter((node) => node.kind === 'sub' && parent.get(node.id) === main)
      .map((node) => node.id)
      .sort(byAmount)
    for (const child of children) {
      rank.set(child, position++)
      groupOf.set(child, main)
    }
  }
  // Sub nodes without a known parent go last.
  for (const node of nodes) if (!rank.has(node.id)) rank.set(node.id, position++)
  return { rank, group: groupOf }
}
