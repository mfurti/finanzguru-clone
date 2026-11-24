<script setup lang="ts">
import { CATEGORY_ICONS, type CategoryNode } from '@finance/shared'

/**
 * Icon and color of a category (003 US3, FR-020). Sub categories only pick an
 * icon; their color comes from the main category, so list, donut, Sankey and
 * bars stay consistent.
 */
const props = defineProps<{ node: CategoryNode; parentColor?: string }>()
const emit = defineEmits<{ change: [patch: { icon?: string; color?: string }] }>()
const { t } = useI18n()
const swatches = CATEGORY_COLOR_KEYS.filter((key) => !['gray', 'zinc'].includes(key))
const icons = Object.entries(CATEGORY_ICONS) as [string, string][]
const color = computed(() => categoryHex(props.parentColor ?? props.node.color))
</script>

<template>
  <UPopover>
    <button
      type="button"
      class="rounded-lg transition-transform hover:scale-105"
      :aria-label="`${t('categoryDetail.icon')} / ${t('categoryDetail.color')}: ${node.name}`"
      :data-testid="`appearance-${node.id}`"
    >
      <CategoryIcon :icon="`i-lucide-${node.icon}`" :color="color" />
    </button>
    <template #content>
      <div class="w-72 space-y-3 p-3">
        <div v-if="!parentColor">
          <p class="mb-1.5 text-xs font-medium text-muted">{{ t('categoryDetail.color') }}</p>
          <div class="grid grid-cols-9 gap-1.5">
            <button
              v-for="key in swatches"
              :key="key"
              type="button"
              class="size-6 rounded-full ring-offset-1 ring-offset-(--ui-bg)"
              :class="key === node.color ? 'ring-2 ring-(--ui-text-highlighted)' : ''"
              :style="{ backgroundColor: categoryHex(key) }"
              :aria-label="key"
              :data-testid="`swatch-${key}`"
              @click="emit('change', { color: key })"
            />
          </div>
        </div>
        <div>
          <p class="mb-1.5 text-xs font-medium text-muted">{{ t('categoryDetail.icon') }}</p>
          <div class="grid max-h-48 grid-cols-8 gap-1 overflow-y-auto">
            <button
              v-for="[key, label] in icons"
              :key="key"
              type="button"
              class="flex size-8 items-center justify-center rounded-md hover:bg-elevated"
              :class="key === node.icon ? 'bg-elevated ring-1 ring-(--ui-border-accented)' : ''"
              :title="label"
              :aria-label="label"
              :data-testid="`icon-${key}`"
              @click="emit('change', { icon: key })"
            >
              <UIcon :name="`i-lucide-${key}`" class="size-4.5" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </UPopover>
</template>
