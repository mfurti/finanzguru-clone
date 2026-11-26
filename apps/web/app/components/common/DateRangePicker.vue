<script setup lang="ts">
import { formatDate } from '@finance/shared'

/**
 * Custom date range (003 US6, FR-010): from/to with German display and a few
 * presets. `null` = no custom range (the period tabs apply).
 */
const model = defineModel<{ from: string; to: string } | null>({ default: null })
const { t } = useI18n()
const open = ref(false)
const draft = reactive({ from: '', to: '' })
watch(open, (isOpen) => {
  if (!isOpen) return
  draft.from = model.value?.from ?? ''
  draft.to = model.value?.to ?? new Date().toISOString().slice(0, 10)
})
const valid = computed(() => !!draft.from && !!draft.to && draft.from <= draft.to)
function apply(): void {
  if (!valid.value) return
  model.value = { from: draft.from, to: draft.to }
  open.value = false
}
function clear(): void {
  model.value = null
  open.value = false
}
const year = new Date().getUTCFullYear()
const presets = [
  { label: String(year - 1), from: `${year - 1}-01-01`, to: `${year - 1}-12-31` },
  { label: String(year - 2), from: `${year - 2}-01-01`, to: `${year - 2}-12-31` },
]
const label = computed(() =>
  model.value ? `${formatDate(model.value.from)} – ${formatDate(model.value.to)}` : null,
)
</script>

<template>
  <UPopover v-model:open="open" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-calendar-range"
      size="sm"
      :variant="model ? 'soft' : 'ghost'"
      :color="model ? 'primary' : 'neutral'"
      :label="label ?? undefined"
      :aria-label="t('refine.customRange')"
      data-testid="range-picker"
    />
    <template #content>
      <form class="grid w-72 gap-3 p-4" data-testid="range-form" @submit.prevent="apply">
        <div class="grid grid-cols-2 gap-2">
          <UFormField :label="t('txws.filters.from')">
            <UInput v-model="draft.from" type="date" data-testid="range-from" />
          </UFormField>
          <UFormField :label="t('txws.filters.to')">
            <UInput v-model="draft.to" type="date" data-testid="range-to" />
          </UFormField>
        </div>
        <div class="flex flex-wrap gap-1">
          <UButton
            v-for="preset in presets"
            :key="preset.label"
            size="xs"
            variant="soft"
            color="neutral"
            :label="preset.label"
            @click="((draft.from = preset.from), (draft.to = preset.to))"
          />
        </div>
        <div class="flex justify-between gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :label="t('txws.filters.reset')"
            :disabled="!model"
            @click="clear"
          />
          <UButton
            type="submit"
            :disabled="!valid"
            :label="t('txws.filters.apply')"
            data-testid="range-apply"
          />
        </div>
      </form>
    </template>
  </UPopover>
</template>
