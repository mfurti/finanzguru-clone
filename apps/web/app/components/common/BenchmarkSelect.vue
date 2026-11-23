<script setup lang="ts">
import type { BenchmarkDto } from '@finance/shared'

/** "Vergleichen mit": pick a benchmark or none (US5). */
const props = defineProps<{ benchmarks: BenchmarkDto[]; stale?: boolean }>()
const model = defineModel<string | null>({ required: true })
const { t } = useI18n()

const NONE = 'none'
const items = computed(() => [
  { value: NONE, label: t('benchmark.none') },
  ...props.benchmarks.map((b) => ({ value: b.instrumentId, label: b.name })),
])
const value = computed({
  get: () => model.value ?? NONE,
  set: (next: string) => (model.value = next === NONE ? null : next),
})
</script>

<template>
  <div class="flex items-center gap-2" data-testid="benchmark-select">
    <span class="text-xs text-muted">{{ t('benchmark.compare') }}</span>
    <UTooltip v-if="benchmarks.length === 0" :text="t('benchmark.empty')">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-info"
        to="/settings/sources"
        :aria-label="t('benchmark.empty')"
      />
    </UTooltip>
    <USelect v-else v-model="value" :items="items" size="xs" class="w-44" />
    <UBadge v-if="stale && model" color="warning" variant="soft" size="sm">
      {{ t('benchmark.stale') }}
    </UBadge>
  </div>
</template>
