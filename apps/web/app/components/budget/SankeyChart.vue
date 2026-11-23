<script setup lang="ts">
import { formatEur, formatPct, type SankeyResponse } from '@finance/shared'
import { sankey, sankeyLeft, sankeyLinkHorizontal } from 'd3-sankey'

/**
 * Income → categories → sub categories (US5 scenario 3), drawn like the
 * reference: wide colored blocks with the label inside, links in the block
 * color, 800 px tall on wide screens. Hovering a block or a link highlights it
 * with everything connected to it and dims the rest; a tooltip shows the
 * amount. Order comes from utils/sankey-order.ts, so no links cross.
 */
const props = defineProps<{ graph: SankeyResponse; incomeCents: number; unit: 'eur' | 'pct' }>()
const { t } = useI18n()

interface NodeIn {
  id: string
  label: string
  kind: 'income' | 'main' | 'sub' | 'balance'
}
interface LinkIn {
  source: string
  target: string
  value: number
}
type LaidNode = NodeIn & { x0: number; x1: number; y0: number; y1: number; index: number }
type LaidLink = {
  source: LaidNode
  target: LaidNode
  value: number
  width: number
  index: number
  y0: number
  y1: number
}

const nodesIn = computed(() => props.graph.nodes as NodeIn[])
const linksIn = computed<LinkIn[]>(() =>
  props.graph.links
    .filter((link) => link.valueCents > 0)
    .map((link) => ({ source: link.source, target: link.target, value: link.valueCents })),
)
const order = computed(() => sankeyOrder(nodesIn.value, linksIn.value))
const rankOf = (id: string) => order.value.rank.get(id) ?? 0

/** Width follows the card; height is 800 px on wide screens like the reference. */
const root = useTemplateRef<HTMLDivElement>('root')
const width = ref(900)
let observer: ResizeObserver | undefined
onMounted(() => {
  if (!root.value) return
  observer = new ResizeObserver(([entry]) => {
    width.value = Math.max(560, Math.round(entry!.contentRect.width))
  })
  observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
const subCount = computed(() => nodesIn.value.filter((node) => node.kind === 'sub').length)
/** Grows with the number of entries (reference: 800 px for ~20 entries). */
const height = computed(() => Math.max(420, Math.min(800, subCount.value * 52 + 160)))

const layout = computed(() => {
  if (linksIn.value.length === 0) return { nodes: [] as LaidNode[], links: [] as LaidLink[] }
  const nodeWidth = Math.min(180, Math.max(80, width.value * 0.16))
  const generator = sankey<NodeIn, LinkIn>()
    .nodeId((node) => node.id)
    .nodeAlign(sankeyLeft)
    .nodeWidth(nodeWidth)
    .nodePadding(14)
    .nodeSort((a, b) => rankOf(a.id) - rankOf(b.id))
    .linkSort(
      (a, b) =>
        rankOf((a.target as NodeIn).id) - rankOf((b.target as NodeIn).id) ||
        rankOf((a.source as NodeIn).id) - rankOf((b.source as NodeIn).id),
    )
    .extent([
      [0, 0],
      [width.value, height.value],
    ])
  const graph = generator({
    nodes: nodesIn.value.map((node) => ({ ...node })),
    links: linksIn.value.map((link) => ({ ...link })),
  })
  return {
    nodes: graph.nodes as unknown as LaidNode[],
    links: graph.links as unknown as LaidLink[],
  }
})
const linkPath = sankeyLinkHorizontal()

/** Totals per node: incoming links, income = total income. */
const totals = computed(() => {
  const map = new Map<string, number>()
  for (const link of linksIn.value) map.set(link.target, (map.get(link.target) ?? 0) + link.value)
  map.set('income', props.incomeCents)
  return map
})
const format = (cents: number) =>
  props.unit === 'eur'
    ? formatEur(cents)
    : formatPct(props.incomeCents > 0 ? cents / props.incomeCents : 0)

/** Soft pastel tones like the reference (lavender, salmon, mint, …). */
const PASTEL = [
  '#8f93f2',
  '#f4a582',
  '#6fd9ad',
  '#f0c870',
  '#82c3f0',
  '#e39ed6',
  '#a9db7b',
  '#ee8f96',
  '#a3b1c4',
]
const colorOf = (id: string) => {
  const node = nodesIn.value.find((n) => n.id === id)
  if (!node || node.kind === 'income') return '#7fdcb5'
  const group = order.value.group.get(id) ?? id
  if (nodesIn.value.find((n) => n.id === group)?.kind === 'balance') return '#82c3f0'
  return PASTEL[(order.value.rank.get(group) ?? 0) % PASTEL.length]!
}
const nodeFill = (id: string) => colorOf(id)
/** Links in the target color, translucent so they read as soft bands. */
const linkFill = (id: string) => `color-mix(in oklab, ${colorOf(id)} 28%, transparent)`

/** Hover: a node or a link plus everything connected to it. */
const active = ref<{ nodes: Set<string>; links: Set<number> } | null>(null)
const tooltip = ref<{ x: number; y: number; text: string } | null>(null)
function hoverNode(node: LaidNode): void {
  const links = layout.value.links.filter(
    (link) => link.source.id === node.id || link.target.id === node.id,
  )
  active.value = {
    nodes: new Set([node.id, ...links.flatMap((link) => [link.source.id, link.target.id])]),
    links: new Set(links.map((link) => link.index)),
  }
}
function hoverLink(link: LaidLink): void {
  active.value = { nodes: new Set([link.source.id, link.target.id]), links: new Set([link.index]) }
}
function move(event: PointerEvent, text: string): void {
  const box = root.value!.getBoundingClientRect()
  tooltip.value = { x: event.clientX - box.left + 12, y: event.clientY - box.top + 12, text }
}
function leave(): void {
  active.value = null
  tooltip.value = null
}
const nodeOpacity = (id: string) => (active.value && !active.value.nodes.has(id) ? 0.25 : 1)
const linkOpacity = (index: number) =>
  active.value ? (active.value.links.has(index) ? 1 : 0.15) : 1

const labelOf = (node: LaidNode) => `${node.label}: ${format(totals.value.get(node.id) ?? 0)}`
const ariaLabel = computed(() =>
  layout.value.nodes
    .filter((node) => node.kind !== 'income')
    .map(labelOf)
    .join(', '),
)
</script>

<template>
  <div data-testid="sankey">
    <EmptyState v-if="linksIn.length === 0" :title="t('budget.noData')" icon="i-lucide-git-fork" />
    <div v-else class="overflow-x-auto">
      <div ref="root" class="relative min-w-[560px]" @pointerleave="leave">
        <ClientOnly>
          <svg
            :width="width"
            :height="height"
            :viewBox="`0 0 ${width} ${height}`"
            role="img"
            :aria-label="ariaLabel"
            class="block"
          >
            <g fill="none">
              <path
                v-for="link in layout.links"
                :key="`l${link.index}`"
                :d="linkPath(link as never) ?? ''"
                :stroke="linkFill(link.target.id)"
                :stroke-width="Math.max(1, link.width)"
                :stroke-opacity="linkOpacity(link.index)"
                class="sankey-link"
                data-testid="sankey-link"
                @pointerenter="hoverLink(link)"
                @pointermove="
                  move($event, `${link.source.label} → ${link.target.label}: ${format(link.value)}`)
                "
              />
            </g>
            <g>
              <g
                v-for="node in layout.nodes"
                :key="node.id"
                :opacity="nodeOpacity(node.id)"
                class="sankey-node"
                data-testid="sankey-node"
                :data-node="node.id"
                @pointerenter="hoverNode(node)"
                @pointermove="move($event, labelOf(node))"
              >
                <rect
                  :x="node.x0"
                  :y="node.y0"
                  :width="node.x1 - node.x0"
                  :height="Math.max(1, node.y1 - node.y0)"
                  :fill="nodeFill(node.id)"
                />
                <text
                  :x="node.kind === 'income' ? node.x0 + 8 : node.x1 - 8"
                  :y="(node.y0 + node.y1) / 2"
                  :text-anchor="node.kind === 'income' ? 'start' : 'end'"
                  dominant-baseline="middle"
                  class="sankey-label"
                >
                  {{ labelOf(node) }}
                </text>
              </g>
            </g>
          </svg>
          <template #fallback><USkeleton class="h-[420px] w-full" /></template>
        </ClientOnly>
        <div
          v-if="tooltip"
          class="pointer-events-none absolute z-10 rounded-md border border-default bg-elevated px-2 py-1 text-xs whitespace-nowrap shadow-sm"
          :style="{ left: `${tooltip.x}px`, top: `${tooltip.y}px` }"
          data-testid="sankey-tooltip"
        >
          {{ tooltip.text }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sankey-link,
.sankey-node {
  cursor: pointer;
  transition:
    stroke-opacity 150ms ease,
    opacity 150ms ease;
}
.sankey-label {
  fill: #fff;
  font-size: 11px;
  font-weight: 600;
  paint-order: stroke;
  stroke: rgb(0 0 0 / 0.18);
  stroke-width: 2px;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .sankey-link,
  .sankey-node {
    transition: none;
  }
}
</style>
