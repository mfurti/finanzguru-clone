<script setup lang="ts">
import { formatEur, formatPct, type SankeyResponse } from '@finance/shared'
import { VisSankey, VisSingleContainer } from '@unovis/vue'

/** Income → categories → sub categories, € or % of income (US5 scenario 3). */
const props = defineProps<{ graph: SankeyResponse; incomeCents: number }>()
const { t } = useI18n()
const unit = ref<'eur' | 'pct'>('eur')

interface Node {
  id: string
  label: string
  kind: string
}
interface Link {
  source: string
  target: string
  value: number
}

const data = computed(() => ({
  nodes: props.graph.nodes as Node[],
  links: props.graph.links.map((link) => ({
    source: link.source,
    target: link.target,
    value: link.valueCents,
  })) as Link[],
}))

const totals = computed(() => {
  const map = new Map<string, number>()
  for (const link of props.graph.links)
    map.set(link.target, (map.get(link.target) ?? 0) + link.valueCents)
  map.set('income', props.incomeCents)
  return map
})
const format = (cents: number) =>
  unit.value === 'eur'
    ? formatEur(cents)
    : formatPct(props.incomeCents > 0 ? cents / props.incomeCents : 0)
const label = (node: Node) => node.label
const subLabel = (node: Node) => format(totals.value.get(node.id) ?? 0)
const nodeColor = (node: Node) =>
  node.kind === 'income'
    ? 'var(--color-emerald-500)'
    : node.kind === 'balance'
      ? 'var(--color-sky-500)'
      : node.kind === 'main'
        ? 'var(--color-rose-500)'
        : 'var(--color-rose-300)'
const height = computed(() =>
  Math.max(240, props.graph.nodes.filter((node) => node.kind === 'sub').length * 28),
)
</script>

<template>
  <div data-testid="sankey">
    <div class="mb-2 flex justify-end">
      <UFieldGroup size="xs">
        <UButton
          :variant="unit === 'eur' ? 'soft' : 'ghost'"
          color="neutral"
          label="€"
          @click="unit = 'eur'"
        />
        <UButton
          :variant="unit === 'pct' ? 'soft' : 'ghost'"
          color="neutral"
          label="%"
          @click="unit = 'pct'"
        />
      </UFieldGroup>
    </div>
    <EmptyState
      v-if="graph.links.length === 0"
      :title="t('budget.noData')"
      icon="i-lucide-git-fork"
    />
    <div v-else class="overflow-x-auto">
      <ClientOnly>
        <VisSingleContainer :data="data" :height="height" class="min-w-[560px] sankey">
          <VisSankey
            :label="label"
            :sub-label="subLabel"
            :node-color="nodeColor"
            :link-color="() => 'var(--ui-border-accented)'"
            :node-width="10"
            :node-padding="10"
            label-position="right"
          />
        </VisSingleContainer>
      </ClientOnly>
    </div>
  </div>
</template>

<style scoped>
.sankey {
  --vis-sankey-node-label-color: var(--ui-text);
  --vis-sankey-node-sublabel-color: var(--ui-text-muted);
}
</style>
