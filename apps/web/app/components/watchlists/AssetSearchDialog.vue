<script setup lang="ts">
/** Button and dialog around the "Asset suchen" panel (005 US4). */
defineProps<{ watchlistId: string }>()
const emit = defineEmits<{ added: [] }>()
const { t } = useI18n()
const open = ref(false)
</script>

<template>
  <UButton
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
