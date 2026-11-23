<script setup lang="ts">
import { PERIODS, type Period } from '@finance/shared'

/** Period switcher 1W … All-time for charts and KPIs. */
const props = withDefaults(defineProps<{ periods?: readonly Period[] }>(), {
  periods: () => PERIODS,
})
const model = defineModel<Period>({ required: true })
const { t } = useI18n()

const items = computed(() =>
  props.periods.map((period) => ({ value: period, label: t(`period.${period}`) })),
)
</script>

<template>
  <div class="flex gap-1 overflow-x-auto [scrollbar-width:none]" role="tablist">
    <UButton
      v-for="item in items"
      :key="item.value"
      size="sm"
      role="tab"
      :aria-selected="model === item.value"
      :color="model === item.value ? 'primary' : 'neutral'"
      :variant="model === item.value ? 'soft' : 'ghost'"
      :label="item.label"
      @click="model = item.value"
    />
  </div>
</template>
