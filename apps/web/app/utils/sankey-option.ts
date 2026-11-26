import { formatEur, formatPct } from '@finance/shared'
import { sankeyOrder, type SankeyLinkIn, type SankeyNodeIn } from './sankey-order'

/** App colours the chart text and tooltip use (read from CSS tokens at runtime). */
export interface SankeyTheme {
  text: string
  muted: string
  tooltipBackground: string
  tooltipBorder: string
  /** Card background: outline around label text so labels stay readable over flows. */
  background: string
}

export interface SankeyOptionInput {
  nodes: readonly SankeyNodeIn[]
  /** Link values in cents; links with a value ≤ 0 are dropped. */
  links: readonly SankeyLinkIn[]
  incomeCents: number
  unit: 'eur' | 'pct'
  colorOf: (nodeId: string) => string
  theme: SankeyTheme
  /** Chart height in px (labels of blocks below `SANKEY_MIN_LABEL_PX` are hidden). */
  height: number
  /** Node id of the selected block (outlined). */
  selectedNodeId?: string | null
  reducedMotion?: boolean
  /** Space reserved right of the last column for its labels. */
  labelSpace?: number
}

export const SANKEY_NODE_WIDTH = 12
export const SANKEY_NODE_GAP = 12
export const SANKEY_MIN_LABEL_PX = 10
const PADDING = 8

const DEPTH: Record<SankeyNodeIn['kind'], number> = { income: 0, main: 1, balance: 1, sub: 2 }

/** Escapes text for the HTML tooltip (category names are owner-defined). */
function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  )
}

/**
 * Width in px the labels of the last column need (name bold + amount), estimated from the
 * longest one at 12 px text; used to reserve room right of the chart.
 */
export function sankeyLabelSpace(
  input: Pick<SankeyOptionInput, 'nodes' | 'links' | 'unit' | 'incomeCents'>,
): number {
  const totals = sankeyNodeTotals(input.links.filter((link) => link.value > 0))
  const last = input.nodes.filter((node) => node.kind === 'sub' && totals.has(node.id))
  const format = (cents: number) =>
    input.unit === 'eur'
      ? formatEur(cents)
      : formatPct(input.incomeCents > 0 ? cents / input.incomeCents : 0)
  const longest = Math.max(
    0,
    ...last.map((node) => node.label.length * 7.2 + format(totals.get(node.id) ?? 0).length * 6.6),
  )
  return Math.round(longest + 30)
}

/** Amount of a block: its incoming flows, or its outgoing ones for the income block. */
export function sankeyNodeTotals(links: readonly SankeyLinkIn[]): Map<string, number> {
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  for (const link of links) {
    incoming.set(link.target, (incoming.get(link.target) ?? 0) + link.value)
    outgoing.set(link.source, (outgoing.get(link.source) ?? 0) + link.value)
  }
  const totals = new Map<string, number>()
  for (const id of new Set([...incoming.keys(), ...outgoing.keys()]))
    totals.set(id, Math.max(incoming.get(id) ?? 0, outgoing.get(id) ?? 0))
  return totals
}

/**
 * Builds the ECharts sankey option from the cash-flow graph (011 R1–R4): nodes in the
 * crossing-free order of `sankeyOrder` with fixed columns and no relaxation, slim rounded
 * blocks in the category colour, gradient flows, labels beside the blocks (hidden for blocks
 * too small to hold one), adjacency focus on hover and a German tooltip with amount and share.
 */
export function buildSankeyOption(input: SankeyOptionInput) {
  const links = input.links.filter((link) => link.value > 0)
  const used = new Set(links.flatMap((link) => [link.source, link.target]))
  const { rank } = sankeyOrder(input.nodes, links)
  const nodes = input.nodes
    .filter((node) => used.has(node.id))
    .slice()
    .sort((a, b) => DEPTH[a.kind] - DEPTH[b.kind] || (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
  const totals = sankeyNodeTotals(links)
  const labelOf = new Map(nodes.map((node) => [node.id, node.label]))

  const format = (cents: number) =>
    input.unit === 'eur'
      ? formatEur(cents)
      : formatPct(input.incomeCents > 0 ? cents / input.incomeCents : 0)
  const share = (cents: number) => formatPct(input.incomeCents > 0 ? cents / input.incomeCents : 0)

  // Pixel height of each block, to hide labels that would not fit (R4).
  const columns = new Map<number, string[]>()
  for (const node of nodes) {
    const depth = DEPTH[node.kind]
    columns.set(depth, [...(columns.get(depth) ?? []), node.id])
  }
  const pixels = new Map<string, number>()
  for (const ids of columns.values()) {
    const sum = ids.reduce((acc, id) => acc + (totals.get(id) ?? 0), 0)
    const free = input.height - PADDING * 2 - SANKEY_NODE_GAP * (ids.length - 1)
    for (const id of ids) pixels.set(id, sum > 0 ? ((totals.get(id) ?? 0) / sum) * free : 0)
  }

  return {
    animation: !input.reducedMotion,
    animationDuration: 600,
    tooltip: {
      trigger: 'item' as const,
      confine: true,
      backgroundColor: input.theme.tooltipBackground,
      borderColor: input.theme.tooltipBorder,
      textStyle: { color: input.theme.text, fontSize: 12 },
      formatter: (params: {
        dataType?: string
        name?: string
        data?: { source?: string; target?: string }
        value?: number
      }) => {
        const cents = Number(params.value ?? 0)
        const title =
          params.dataType === 'edge'
            ? `${escapeHtml(labelOf.get(params.data?.source ?? '') ?? '')} → ${escapeHtml(labelOf.get(params.data?.target ?? '') ?? '')}`
            : escapeHtml(labelOf.get(params.name ?? '') ?? '')
        return `${title}<br/><b>${formatEur(cents)}</b> · ${share(cents)} der Einnahmen`
      },
    },
    series: [
      {
        type: 'sankey' as const,
        left: PADDING,
        top: PADDING,
        bottom: PADDING,
        right: input.labelSpace ?? 170,
        nodeWidth: SANKEY_NODE_WIDTH,
        nodeGap: SANKEY_NODE_GAP,
        nodeAlign: 'justify' as const,
        layoutIterations: 0,
        draggable: false,
        emphasis: { focus: 'adjacency' as const },
        blur: { itemStyle: { opacity: 0.25 }, lineStyle: { opacity: 0.08 } },
        itemStyle: { borderRadius: 3, borderWidth: 0 },
        lineStyle: { color: 'gradient' as const, curveness: 0.5, opacity: 0.35 },
        label: {
          position: 'right' as const,
          distance: 8,
          color: input.theme.text,
          fontSize: 12,
          textBorderColor: input.theme.background,
          textBorderWidth: 2,
          formatter: (params: { name: string }) =>
            `{name|${labelOf.get(params.name) ?? ''}}  {value|${format(totals.get(params.name) ?? 0)}}`,
          rich: {
            name: {
              color: input.theme.text,
              fontSize: 12,
              fontWeight: 600,
              textBorderColor: input.theme.background,
              textBorderWidth: 2,
            },
            value: {
              color: input.theme.muted,
              fontSize: 12,
              textBorderColor: input.theme.background,
              textBorderWidth: 2,
            },
          },
        },
        data: nodes.map((node) => ({
          name: node.id,
          depth: DEPTH[node.kind],
          value: totals.get(node.id) ?? 0,
          itemStyle: {
            color: input.colorOf(node.id),
            ...(input.selectedNodeId === node.id
              ? { borderColor: input.theme.text, borderWidth: 2 }
              : {}),
          },
          label: { show: (pixels.get(node.id) ?? 0) >= SANKEY_MIN_LABEL_PX },
        })),
        links: links.map((link) => ({
          source: link.source,
          target: link.target,
          value: link.value,
        })),
      },
    ],
  }
}
