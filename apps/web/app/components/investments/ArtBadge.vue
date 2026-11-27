<script setup lang="ts">
/**
 * Kind of an investment booking as a small coloured badge like the reference (012 P4):
 * Kauf green, Verkauf blue, everything else neutral.
 */
const props = defineProps<{ type: string }>()
const { t } = useI18n()
const color = computed(() =>
  props.type === 'buy' ? 'success' : props.type === 'sell' ? 'info' : 'neutral',
)
</script>

<template>
  <UBadge
    :label="t(`transactionTypes.${type}`)"
    :color="color"
    variant="subtle"
    size="sm"
    class="whitespace-nowrap"
    :data-type="type"
    data-testid="art-badge"
  />
</template>
