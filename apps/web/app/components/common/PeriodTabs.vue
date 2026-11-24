<script setup lang="ts">
import { PERIODS, type Period } from '@finance/shared'

/** Period switcher 1W … All-time for charts and KPIs. */
/** `inactive`: a custom range is shown, so no tab is marked (003 US6). */
const props = withDefaults(defineProps<{ periods?: readonly Period[]; inactive?: boolean }>(), {
  periods: () => PERIODS,
})
const model = defineModel<Period>({ required: true })
const emit = defineEmits<{ pick: [] }>()
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
      :aria-selected="!inactive && model === item.value"
      :color="!inactive && model === item.value ? 'primary' : 'neutral'"
      :variant="!inactive && model === item.value ? 'soft' : 'ghost'"
      :label="item.label"
      @click="((model = item.value), emit('pick'))"
    />
  </div>
</template>
