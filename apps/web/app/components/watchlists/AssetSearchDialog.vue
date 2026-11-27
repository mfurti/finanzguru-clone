<script setup lang="ts">
/**
 * Button and dialog around the "Asset suchen" panel (005 US4). The open state is a v-model,
 * so the watchlist header and empty state can open it too (012 P10); `trigger: false` hides
 * the own button.
 */
withDefaults(defineProps<{ watchlistId: string; trigger?: boolean }>(), { trigger: true })
const emit = defineEmits<{ added: [] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()
</script>

<template>
  <UButton
    v-if="trigger"
    icon="i-lucide-search"
    :label="t('marketData.search')"
    data-testid="asset-search-open"
    @click="open = true"
  />
  <UModal v-model:open="open" :title="t('marketData.search')" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <AssetSearch :watchlist-id="watchlistId" @added="emit('added')" />
    </template>
  </UModal>
</template>
