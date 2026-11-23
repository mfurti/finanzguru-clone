<script setup lang="ts">
/** Prev/next, "Aktueller Monat" and Monat/Quartal/Jahr (US5 scenario 2). */
defineProps<{ label: string }>()
const { t } = useI18n()
const { granularity, isCurrent, previous, next, reset } = useBudgetPeriod()
const items = computed(() => [
  { label: t('budget.month'), value: 'month' },
  { label: t('budget.quarter'), value: 'quarter' },
  { label: t('budget.year'), value: 'year' },
])
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2" data-testid="period-switcher">
    <div class="flex items-center gap-1">
      <UButton
        icon="i-lucide-chevron-left"
        variant="ghost"
        color="neutral"
        :aria-label="t('budget.previous')"
        data-testid="period-prev"
        @click="previous"
      />
      <UButton
        icon="i-lucide-chevron-right"
        variant="ghost"
        color="neutral"
        :disabled="isCurrent"
        :aria-label="t('budget.next')"
        data-testid="period-next"
        @click="next"
      />
      <span class="ml-1 text-xl font-bold" data-testid="period-label">{{ label }}</span>
    </div>
    <div class="flex items-center gap-2">
      <UButton
        v-if="!isCurrent"
        size="sm"
        variant="soft"
        color="neutral"
        :label="t('budget.current')"
        @click="reset"
      />
      <UTabs
        v-model="granularity"
        :items="items"
        :content="false"
        size="sm"
        data-testid="granularity"
      />
    </div>
  </div>
</template>
