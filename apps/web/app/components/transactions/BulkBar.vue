<script setup lang="ts">
import type { TagDto } from '@finance/shared'

/**
 * Actions for the selected bookings (FR-005): set category, add/remove tags,
 * mark reviewed, delete (undo lives in the table's toast).
 */
const props = defineProps<{ ids: string[]; tags: TagDto[] }>()
/** `setCategory` opens the category window for the selection (007 US1). */
const emit = defineEmits<{ setCategory: []; delete: []; done: [] }>()
const { t } = useI18n()

async function run(action: string, value?: string | string[]): Promise<void> {
  await apiFetch('/api/transactions/bulk', {
    method: 'POST',
    body: { ids: props.ids, action, value },
  })
  emit('done')
}

const tagMenu = computed(() => [
  props.tags.map((item) => ({
    label: item.name,
    icon: 'i-lucide-tag',
    onSelect: () => run('addTags', [item.id]),
  })),
  props.tags.length > 0
    ? [
        {
          label: t('tags.title'),
          type: 'label' as const,
        },
        ...props.tags.map((item) => ({
          label: `– ${item.name}`,
          icon: 'i-lucide-x',
          onSelect: () => run('removeTags', [item.id]),
        })),
      ]
    : [],
])
</script>

<template>
  <!--
    Floats above the account filter instead of sitting above the table, so selecting a row
    never pushes the rows down (no layout shift while ticking several checkboxes).
  -->
  <div
    class="pointer-events-none fixed inset-x-0 bottom-16 z-40 flex justify-center px-4"
    role="toolbar"
    :aria-label="t('txws.selected', { n: ids.length })"
    data-testid="bulk-bar"
  >
    <div
      class="pointer-events-auto flex max-w-full flex-wrap items-center gap-2 rounded-xl border border-default bg-elevated px-3 py-2 shadow-lg"
    >
      <span class="text-sm font-medium">{{ t('txws.selected', { n: ids.length }) }}</span>
      <UButton
        icon="i-lucide-shapes"
        size="sm"
        variant="soft"
        color="neutral"
        :label="t('txws.setCategory')"
        data-testid="bulk-category"
        @click="emit('setCategory')"
      />
      <UDropdownMenu v-if="tags.length > 0" :items="tagMenu">
        <UButton
          icon="i-lucide-tags"
          size="sm"
          variant="soft"
          color="neutral"
          :label="t('txws.setTags')"
          data-testid="bulk-tags"
        />
      </UDropdownMenu>
      <UButton
        icon="i-lucide-check-check"
        size="sm"
        variant="soft"
        color="neutral"
        :label="t('txws.markReviewed')"
        data-testid="bulk-reviewed"
        @click="run('markReviewed')"
      />
      <UButton
        icon="i-lucide-trash-2"
        size="sm"
        variant="soft"
        color="error"
        :label="t('txws.delete')"
        data-testid="bulk-delete"
        @click="emit('delete')"
      />
    </div>
  </div>
</template>
