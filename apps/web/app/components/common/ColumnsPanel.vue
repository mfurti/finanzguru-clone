<script setup lang="ts">
/**
 * "Spalten" side panel like the reference (012 P2): select all, one checkbox per column with
 * a drag handle to reorder (plus move buttons for keyboard users) and "Speichern". Changes
 * apply only on save; closing discards them.
 */
export interface ColumnChoice {
  order: string[]
  visible: Record<string, boolean>
}

const props = defineProps<{
  /** Hideable columns in their default order. */
  columns: { id: string; label: string }[]
  choice: ColumnChoice
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ save: [choice: ColumnChoice] }>()
const { t } = useI18n()

const draft = ref<ColumnChoice>({ order: [], visible: {} })
const labelOf = computed(() => new Map(props.columns.map((column) => [column.id, column.label])))
watch(
  open,
  (isOpen) => {
    if (!isOpen) return
    const known = props.columns.map((column) => column.id)
    const order = [
      ...props.choice.order.filter((id) => known.includes(id)),
      ...known.filter((id) => !props.choice.order.includes(id)),
    ]
    draft.value = {
      order,
      visible: Object.fromEntries(order.map((id) => [id, props.choice.visible[id] !== false])),
    }
  },
  { immediate: true },
)

const allChecked = computed(() => draft.value.order.every((id) => draft.value.visible[id]))
const someChecked = computed(() => draft.value.order.some((id) => draft.value.visible[id]))
function setAll(checked: boolean | 'indeterminate'): void {
  const value = checked === true
  draft.value.visible = Object.fromEntries(draft.value.order.map((id) => [id, value]))
}
function move(from: number, to: number): void {
  if (to < 0 || to >= draft.value.order.length || from === to) return
  const order = [...draft.value.order]
  const [id] = order.splice(from, 1)
  order.splice(to, 0, id!)
  draft.value.order = order
}

const dragging = ref<number | null>(null)
function drop(index: number): void {
  if (dragging.value !== null) move(dragging.value, index)
  dragging.value = null
}

function save(): void {
  emit('save', { order: [...draft.value.order], visible: { ...draft.value.visible } })
  open.value = false
}
</script>

<template>
  <USlideover v-model:open="open" :title="t('columnsPanel.title')" data-testid="columns-panel">
    <template #body>
      <div class="space-y-1">
        <UCheckbox
          :model-value="allChecked ? true : someChecked ? 'indeterminate' : false"
          :label="t('columnsPanel.selectAll')"
          class="px-2 py-2 font-medium"
          data-testid="columns-select-all"
          @update:model-value="setAll"
        />
        <ul data-testid="columns-list">
          <li
            v-for="(id, index) in draft.order"
            :key="id"
            draggable="true"
            class="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-elevated/50"
            :class="{ 'opacity-50': dragging === index }"
            :data-column="id"
            @dragstart="dragging = index"
            @dragover.prevent
            @drop.prevent="drop(index)"
            @dragend="dragging = null"
          >
            <UCheckbox
              v-model="draft.visible[id]"
              :label="labelOf.get(id)"
              class="flex-1"
              :data-testid="`columns-toggle-${id}`"
            />
            <UButton
              icon="i-lucide-chevron-up"
              size="xs"
              variant="ghost"
              color="neutral"
              :disabled="index === 0"
              :aria-label="t('columnsPanel.up', { name: labelOf.get(id) })"
              @click="move(index, index - 1)"
            />
            <UButton
              icon="i-lucide-chevron-down"
              size="xs"
              variant="ghost"
              color="neutral"
              :disabled="index === draft.order.length - 1"
              :aria-label="t('columnsPanel.down', { name: labelOf.get(id) })"
              @click="move(index, index + 1)"
            />
            <UIcon
              name="i-lucide-grip-vertical"
              class="size-4 cursor-grab text-muted"
              aria-hidden="true"
            />
          </li>
        </ul>
      </div>
    </template>
    <template #footer>
      <UButton block :label="t('columnsPanel.save')" data-testid="columns-save" @click="save" />
    </template>
  </USlideover>
</template>
