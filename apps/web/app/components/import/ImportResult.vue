<script setup lang="ts">
import type { ImportJobDto } from '@finance/shared'

/** Outcome of an import: counts and row errors with line numbers. */
const props = defineProps<{ job: ImportJobDto }>()
const { t, te } = useI18n()

const color = computed(() =>
  props.job.status === 'succeeded'
    ? 'success'
    : props.job.status === 'partial'
      ? 'warning'
      : 'error',
)
const reason = (key: string) => (te(`import.reasons.${key}`) ? t(`import.reasons.${key}`) : key)
</script>

<template>
  <div class="space-y-3" data-testid="import-result">
    <UAlert
      :color="color"
      variant="subtle"
      :title="t(`import.status.${job.status}`)"
      :icon="job.status === 'failed' ? 'i-lucide-circle-x' : 'i-lucide-circle-check'"
    />
    <dl class="grid grid-cols-3 gap-2 text-center">
      <div
        v-for="key in ['imported', 'skipped', 'failed'] as const"
        :key="key"
        class="rounded-md bg-elevated p-2"
      >
        <dt class="text-xs text-muted">{{ t(`import.counts.${key}`) }}</dt>
        <dd class="text-lg font-semibold tabular-nums" :data-testid="`import-${key}`">
          {{ job[key] }}
        </dd>
      </div>
    </dl>
    <div v-if="job.errors.length > 0">
      <h3 class="mb-1 text-sm font-medium">{{ t('import.errors') }}</h3>
      <ul class="max-h-48 overflow-y-auto text-sm" data-testid="import-errors">
        <li v-for="(error, index) in job.errors" :key="index" class="flex gap-2 py-0.5">
          <span v-if="error.line" class="w-16 shrink-0 text-muted">{{
            t('import.line', { n: error.line })
          }}</span>
          <span>{{ reason(error.reason) }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
