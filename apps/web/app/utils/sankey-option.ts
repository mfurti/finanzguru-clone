import { formatEur, formatPct } from '~/utils/privacy'
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
  /** Chart width in px; labels of the first two columns are cut to the gap between columns. */
  width?: number
}

export const SANKEY_NODE_WIDTH = 12
export const SANKEY_NODE_GAP = 12
export const SANKEY_MIN_LABEL_PX = 10
const PADDING = 8

const DEPTH: Record<SankeyNodeIn['kind'], number> = {
  income: 0,
  deficit: 0,
  main: 1,
  balance: 1,
  sub: 2,
}

const FALLBACK_NODE_COLOR = '#9ca3af'
const FALLBACK_THEME: SankeyTheme = {
  text: '#e5e7eb',
  muted: '#9ca3af',
  tooltipBackground: '#1f2937',
  tooltipBorder: '#374151',
  background: '#24272e',
}

/**
 * ECharts animates colours on hover and can only interpolate hex and rgb(a) colours; a CSS
 * colour such as `oklch(…)` breaks the hover animation (011 fix). Anything else falls back.
 */
export function sankeySafeColor(color: string | undefined, fallback: string): string {
  return color && /^(?:#[\da-f]{3,8}|rgba?\([^)]*\))$/i.test(color.trim()) ? color.trim() : fallback
}

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

const FILLER = 'filler:'
/** Invisible filler blocks keep flows straight or downwards (012 P11). */
export const isFiller = (id: string) => id.startsWith(FILLER)

/**
 * A main category whose sub categories add up to less than the main block gets an invisible
 * filler sub block with the rest, placed after its last sub category. Then every main block
 * is fully split and, with mains ordered by `sankeyOrder`, no sub block starts above its main
 * block (012 P11).
 */
export function sankeyFillers(
  nodes: readonly SankeyNodeIn[],
  links: readonly SankeyLinkIn[],
  rank: ReadonlyMap<string, number>,
): { nodes: SankeyNodeIn[]; links: SankeyLinkIn[]; rank: Map<string, number> } {
  const kind = new Map(nodes.map((node) => [node.id, node.kind]))
  const incoming = new Map<string, number>()
  const toSubs = new Map<string, number>()
  const lastSubRank = new Map<string, number>()
  for (const link of links) {
    incoming.set(link.target, (incoming.get(link.target) ?? 0) + link.value)
    if (kind.get(link.source) === 'main' && kind.get(link.target) === 'sub') {
      toSubs.set(link.source, (toSubs.get(link.source) ?? 0) + link.value)
      lastSubRank.set(
        link.source,
        Math.max(lastSubRank.get(link.source) ?? -1, rank.get(link.target) ?? 0),
      )
    }
  }
  const result = { nodes: [] as SankeyNodeIn[], links: [] as SankeyLinkIn[], rank: new Map() }
  for (const [main, subCents] of toSubs) {
    const rest = (incoming.get(main) ?? 0) - subCents
    if (rest <= 0) continue
    const id = `${FILLER}${main}`
    result.nodes.push({ id, label: '', kind: 'sub' })
    result.links.push({ source: main, target: id, value: rest })
    result.rank.set(id, (lastSubRank.get(main) ?? 0) + 0.5)
  }
  return result
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
  const theme: SankeyTheme = {
    text: sankeySafeColor(input.theme.text, FALLBACK_THEME.text),
    muted: sankeySafeColor(input.theme.muted, FALLBACK_THEME.muted),
    tooltipBackground: sankeySafeColor(
      input.theme.tooltipBackground,
      FALLBACK_THEME.tooltipBackground,
    ),
    tooltipBorder: sankeySafeColor(input.theme.tooltipBorder, FALLBACK_THEME.tooltipBorder),
    background: sankeySafeColor(input.theme.background, FALLBACK_THEME.background),
  }
  const realLinks = input.links.filter((link) => link.value > 0)
  const { rank } = sankeyOrder(input.nodes, realLinks)
  const fillers = sankeyFillers(input.nodes, realLinks, rank)
  const links = [...realLinks, ...fillers.links]
  const used = new Set(links.flatMap((link) => [link.source, link.target]))
  const nodes = [...input.nodes, ...fillers.nodes]
    .filter((node) => used.has(node.id))
    .sort(
      (a, b) =>
        DEPTH[a.kind] - DEPTH[b.kind] ||
        (rank.get(a.id) ?? fillers.rank.get(a.id) ?? 0) -
          (rank.get(b.id) ?? fillers.rank.get(b.id) ?? 0),
    )
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

  // Labels of columns 0 and 1 stand in the gap to the next column; cut them to fit (011 T008).
  const right = input.labelSpace ?? 170
  const columnGap = input.width
    ? (input.width - PADDING - right - SANKEY_NODE_WIDTH * 3) / 2
    : Number.POSITIVE_INFINITY
  const innerLabelWidth = Math.max(40, Math.floor(columnGap - 16))

  return {
    animation: !input.reducedMotion,
    animationDuration: 600,
    tooltip: {
      trigger: 'item' as const,
      confine: true,
      backgroundColor: theme.tooltipBackground,
      borderColor: theme.tooltipBorder,
      textStyle: { color: theme.text, fontSize: 12 },
      formatter: (params: {
        dataType?: string
        name?: string
        data?: { source?: string; target?: string }
        value?: number
      }) => {
        const cents = Number(params.value ?? 0)
        const id = params.dataType === 'edge' ? (params.data?.target ?? '') : (params.name ?? '')
        if (isFiller(id)) return ''
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
        right,
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
          color: theme.text,
          fontSize: 12,
          textBorderColor: theme.background,
          textBorderWidth: 2,
          formatter: (params: { name: string }) =>
            `{name|${labelOf.get(params.name) ?? ''}}  {value|${format(totals.get(params.name) ?? 0)}}`,
          rich: {
            name: {
              color: theme.text,
              fontSize: 12,
              fontWeight: 600,
              textBorderColor: theme.background,
              textBorderWidth: 2,
            },
            value: {
              color: theme.muted,
              fontSize: 12,
              textBorderColor: theme.background,
              textBorderWidth: 2,
            },
          },
        },
        data: nodes.map((node) =>
          isFiller(node.id)
            ? {
                name: node.id,
                depth: DEPTH[node.kind],
                value: totals.get(node.id) ?? 0,
                itemStyle: { color: 'rgba(0, 0, 0, 0)', opacity: 0 },
                label: { show: false },
                emphasis: { disabled: true },
                blur: { itemStyle: { opacity: 0 } },
                tooltip: { show: false },
              }
            : {
                name: node.id,
                depth: DEPTH[node.kind],
                value: totals.get(node.id) ?? 0,
                itemStyle: {
                  color: sankeySafeColor(input.colorOf(node.id), FALLBACK_NODE_COLOR),
                  ...(input.selectedNodeId === node.id
                    ? { borderColor: theme.text, borderWidth: 2 }
                    : {}),
                },
                label: {
                  show: (pixels.get(node.id) ?? 0) >= SANKEY_MIN_LABEL_PX,
                  ...(DEPTH[node.kind] < 2 && Number.isFinite(columnGap)
                    ? { width: innerLabelWidth, overflow: 'truncate' as const, ellipsis: '…' }
                    : {}),
                },
              },
        ),
        links: links.map((link) =>
          isFiller(link.target)
            ? {
                source: link.source,
                target: link.target,
                value: link.value,
                lineStyle: { opacity: 0 },
                emphasis: { disabled: true },
                blur: { lineStyle: { opacity: 0 } },
                tooltip: { show: false },
              }
            : { source: link.source, target: link.target, value: link.value },
        ),
      },
    ],
  }
}
