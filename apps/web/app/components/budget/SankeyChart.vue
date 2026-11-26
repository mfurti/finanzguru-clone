<script setup lang="ts">
import { formatEur, formatPct, type SankeyResponse } from '@finance/shared'
import type { SankeyLinkIn, SankeyNodeIn } from '~/utils/sankey-order'

/**
 * Income → categories → sub categories (US5 scenario 3), drawn with Apache ECharts (011):
 * slim rounded blocks in the category colour with their name and amount beside them, flows
 * coloured from source to target, hover keeps everything connected and fades the rest, the
 * tooltip shows amount and share of income. Order comes from utils/sankey-order.ts, so no
 * flows cross. ECharts is loaded lazily and only in the browser.
 */
const props = defineProps<{
  graph: SankeyResponse
  incomeCents: number
  unit: 'eur' | 'pct'
  /** Category id of the block that filters the bookings below (Sankey page, FR-019). */
  selected?: string | null
  /** Upper height limit; the Analyse card uses a compact one (007 US4). */
  maxHeight?: number
}>()
const emit = defineEmits<{ select: [categoryId: string | null] }>()
const { t } = useI18n()

const VChart = defineAsyncComponent(async () => {
  const [chart, setup] = await Promise.all([import('vue-echarts'), import('~/utils/echarts')])
  setup.registerSankeyCharts()
  return chart.default
})

const nodesIn = computed(() => props.graph.nodes as SankeyNodeIn[])
const linksIn = computed<SankeyLinkIn[]>(() =>
  props.graph.links
    .filter((link) => link.valueCents > 0)
    .map((link) => ({ source: link.source, target: link.target, value: link.valueCents })),
)

/** Width follows the card; the label column shrinks on narrow cards. */
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
const height = computed(() => {
  const max = props.maxHeight ?? 800
  return Math.min(max, Math.max(420, Math.min(800, subCount.value * 44 + 160)))
})
/** Room for the last column's labels: as long as the longest, at most 40 % of the card. */
const labelSpace = computed(() =>
  Math.min(
    Math.round(width.value * 0.4),
    sankeyLabelSpace({
      nodes: nodesIn.value,
      links: linksIn.value,
      unit: props.unit,
      incomeCents: props.incomeCents,
    }),
  ),
)

/** One colour per category (research R9): main blocks in the category colour, subs lighter. */
const { colorOf: categoryColor, shade } = await useCategoryAppearance()
const kindOf = computed(() => new Map(nodesIn.value.map((node) => [node.id, node.kind])))
function colorOf(id: string): string {
  const kind = kindOf.value.get(id)
  if (!kind || kind === 'income') return '#7fdcb5'
  if (kind === 'balance') return '#82c3f0'
  const categoryId = id.replace(/^(main|sub):/, '')
  return kind === 'sub' ? shade(categoryId, 1) : categoryColor(categoryId)
}

/** Text and tooltip colours from the app tokens; read again when the colour mode changes. */
const theme = ref({
  text: '#e5e7eb',
  muted: '#9ca3af',
  tooltipBackground: '#1f2937',
  tooltipBorder: '#374151',
})
function readTheme(): void {
  const style = getComputedStyle(document.documentElement)
  const token = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback
  theme.value = {
    text: token('--ui-text-highlighted', theme.value.text),
    muted: token('--ui-text-muted', theme.value.muted),
    tooltipBackground: token('--ui-bg-elevated', theme.value.tooltipBackground),
    tooltipBorder: token('--ui-border', theme.value.tooltipBorder),
    background: token('--app-card', theme.value.background),
  }
}
const reducedMotion = ref(false)
/** The colour mode switches a class on <html>; read the tokens again once it has changed. */
let themeObserver: MutationObserver | undefined
onMounted(() => {
  readTheme()
  reducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  themeObserver = new MutationObserver(readTheme)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => themeObserver?.disconnect())

const selectedNodeId = computed(() =>
  props.selected
    ? (nodesIn.value.find(
        (n) => n.id === `main:${props.selected}` || n.id === `sub:${props.selected}`,
      )?.id ?? null)
    : null,
)
const option = computed(() =>
  buildSankeyOption({
    nodes: nodesIn.value,
    links: linksIn.value,
    incomeCents: props.incomeCents,
    unit: props.unit,
    colorOf,
    theme: theme.value,
    height: height.value,
    selectedNodeId: selectedNodeId.value,
    reducedMotion: reducedMotion.value,
    labelSpace: labelSpace.value,
  }),
)

/** Click a category block: filter the bookings; again (or another kind of block) clears it. */
function selectNode(nodeId: string): void {
  const kind = kindOf.value.get(nodeId)
  if (kind !== 'main' && kind !== 'sub') return emit('select', null)
  const categoryId = nodeId.replace(/^(main|sub):/, '')
  emit('select', props.selected === categoryId ? null : categoryId)
}
function onChartClick(params: { dataType?: string; name?: string }): void {
  if (params.dataType === 'node' && params.name) selectNode(params.name)
}

const totals = computed(() => sankeyNodeTotals(linksIn.value))
/**
 * Category blocks in chart order for the keyboard list (011 R5): ECharts draws plain SVG,
 * so this list gives keyboard users (and tests) the same way to select a block.
 */
const blocks = computed(() => {
  const { rank } = sankeyOrder(nodesIn.value, linksIn.value)
  return nodesIn.value
    .filter((node) => (node.kind === 'main' || node.kind === 'sub') && totals.value.has(node.id))
    .sort(
      (a, b) =>
        Number(a.kind === 'sub') - Number(b.kind === 'sub') ||
        (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0),
    )
})
const blockValue = (id: string) =>
  props.unit === 'eur'
    ? formatEur(totals.value.get(id) ?? 0)
    : formatPct(props.incomeCents > 0 ? (totals.value.get(id) ?? 0) / props.incomeCents : 0)
const ariaLabel = computed(() =>
  nodesIn.value
    .filter((node) => node.kind !== 'income' && totals.value.has(node.id))
    .map((node) => `${node.label}: ${formatEur(totals.value.get(node.id) ?? 0)}`)
    .join(', '),
)
</script>

<template>
  <div data-testid="sankey">
    <EmptyState v-if="linksIn.length === 0" :title="t('budget.noData')" icon="i-lucide-git-fork" />
    <div v-else class="overflow-x-auto">
      <div ref="root" class="min-w-[560px]" role="img" :aria-label="ariaLabel">
        <ClientOnly>
          <VChart
            :option="option"
            :style="{ height: `${height}px` }"
            :init-options="{ renderer: 'svg' }"
            autoresize
            class="w-full"
            data-testid="sankey-chart"
            @click="onChartClick"
          />
          <template #fallback
            ><USkeleton class="w-full" :style="{ height: `${height}px` }"
          /></template>
        </ClientOnly>
      </div>
    </div>
    <ul
      v-if="linksIn.length > 0"
      class="sr-only flex-wrap gap-2 pt-3 focus-within:not-sr-only focus-within:flex"
      :aria-label="t('budget.sankeyBlocks')"
    >
      <li v-for="node in blocks" :key="node.id">
        <button
          type="button"
          class="rounded-md border border-default px-2 py-1 text-xs focus-visible:outline-2 focus-visible:outline-(--ui-primary)"
          :aria-pressed="selectedNodeId === node.id"
          data-testid="sankey-node"
          :data-node="node.id"
          @click="selectNode(node.id)"
        >
          {{ node.label }}: {{ blockValue(node.id) }}
        </button>
      </li>
    </ul>
  </div>
</template>
