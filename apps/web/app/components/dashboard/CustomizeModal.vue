<script setup lang="ts">
import type { WidgetKey, WidgetLayoutItem } from '@finance/shared'

/** "Anpassen": reorder and hide overview widgets (FR-013). */
const props = defineProps<{ layout: WidgetLayoutItem[] }>()
const emit = defineEmits<{ save: [layout: WidgetLayoutItem[]] }>()
const open = defineModel<boolean>('open', { default: false })
const { t } = useI18n()

const draft = ref<WidgetLayoutItem[]>([])
watch(
  open,
  (isOpen) => {
    if (isOpen) draft.value = props.layout.map((item) => ({ ...item }))
  },
  { immediate: true },
)

function move(index: number, delta: -1 | 1): void {
  const target = index + delta
  if (target < 0 || target >= draft.value.length) return
  const items = [...draft.value]
  ;[items[index], items[target]] = [items[target]!, items[index]!]
  draft.value = items
}

function save(): void {
  emit(
    'save',
    draft.value.map((item, position) => ({ ...item, position })),
  )
  open.value = false
}

const label = (key: WidgetKey) => t(`overview.widgets.${key}`)
</script>

<template>
  <UModal v-model:open="open" :title="t('overview.customize.title')">
    <template #body>
      <ul class="divide-y divide-default" data-testid="customize-list">
        <li
          v-for="(item, index) in draft"
          :key="item.widgetKey"
          class="flex items-center justify-between gap-2 py-2"
        >
          <UCheckbox v-model="item.visible" :label="label(item.widgetKey)" />
          <span class="flex gap-1">
            <UButton
              icon="i-lucide-arrow-up"
              size="xs"
              variant="ghost"
              color="neutral"
              :disabled="index === 0"
              :aria-label="t('overview.customize.up')"
              @click="move(index, -1)"
            />
            <UButton
              icon="i-lucide-arrow-down"
              size="xs"
              variant="ghost"
              color="neutral"
              :disabled="index === draft.length - 1"
              :aria-label="t('overview.customize.down')"
              @click="move(index, 1)"
            />
          </span>
        </li>
      </ul>
    </template>
    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          variant="ghost"
          color="neutral"
          :label="t('common.cancel')"
          @click="open = false"
        />
        <UButton :label="t('common.save')" data-testid="customize-save" @click="save" />
      </div>
    </template>
  </UModal>
</template>
