<script setup lang="ts">
import type { TagDto } from '@finance/shared'
import { FetchError } from 'ofetch'

/** "Tags" modal (research R4): list with usage, create, rename, recolor, delete. */
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ changed: [] }>()
const { t } = useI18n()
const toast = useToast()

const { data: tags, refresh } = await useApi<TagDto[]>('/api/tags', {
  key: 'tags',
  default: () => [],
})
const name = ref('')
const editing = ref<{ id: string; name: string } | null>(null)
const swatches = CATEGORY_COLOR_KEYS.filter((key) => !['gray', 'zinc'].includes(key))

async function call(run: () => Promise<unknown>): Promise<void> {
  try {
    await run()
    await refresh()
    emit('changed')
  } catch (error) {
    const duplicate = error instanceof FetchError && error.statusCode === 409
    toast.add({ title: duplicate ? t('tags.duplicate') : t('common.error'), color: 'error' })
  }
}
const create = () =>
  call(async () => {
    if (!name.value.trim()) return
    await apiFetch('/api/tags', { method: 'POST', body: { name: name.value } })
    name.value = ''
  })
const rename = () =>
  call(async () => {
    if (!editing.value) return
    await apiFetch(`/api/tags/${editing.value.id}`, {
      method: 'PATCH',
      body: { name: editing.value.name },
    })
    editing.value = null
  })
const recolor = (id: string, color: string) =>
  call(() => apiFetch(`/api/tags/${id}`, { method: 'PATCH', body: { color } }))
const remove = (item: TagDto) =>
  call(async () => {
    if (!window.confirm(t('tags.deleteConfirm', { name: item.name }))) return
    await apiFetch(`/api/tags/${item.id}`, { method: 'DELETE' })
  })
</script>

<template>
  <UModal v-model:open="open" :title="t('tags.title')" data-testid="tag-manager">
    <template #body>
      <form class="mb-4 flex gap-2" @submit.prevent="create">
        <UInput
          v-model="name"
          :placeholder="t('tags.new')"
          maxlength="40"
          class="flex-1"
          data-testid="tag-name"
        />
        <UButton
          type="submit"
          icon="i-lucide-plus"
          :label="t('common.add')"
          data-testid="tag-add"
        />
      </form>
      <EmptyState v-if="(tags?.length ?? 0) === 0" :title="t('tags.empty')" icon="i-lucide-tags" />
      <ul v-else class="divide-y divide-default">
        <li
          v-for="item in tags"
          :key="item.id"
          class="flex items-center gap-2 py-2"
          data-testid="tag-row"
        >
          <UPopover>
            <button
              type="button"
              class="size-5 shrink-0 rounded-full ring-1 ring-default"
              :style="{ backgroundColor: categoryHex(item.color) }"
              :aria-label="t('tags.color')"
            />
            <template #content>
              <div class="grid grid-cols-6 gap-1.5 p-2">
                <button
                  v-for="key in swatches"
                  :key="key"
                  type="button"
                  class="size-6 rounded-full ring-offset-1 ring-offset-(--ui-bg)"
                  :class="key === item.color ? 'ring-2 ring-(--ui-text-highlighted)' : ''"
                  :style="{ backgroundColor: categoryHex(key) }"
                  :aria-label="key"
                  @click="recolor(item.id, key)"
                />
              </div>
            </template>
          </UPopover>
          <form v-if="editing?.id === item.id" class="flex flex-1 gap-1" @submit.prevent="rename">
            <UInput v-model="editing.name" size="sm" maxlength="40" class="flex-1" autofocus />
            <UButton type="submit" size="sm" icon="i-lucide-check" :aria-label="t('common.save')" />
          </form>
          <button
            v-else
            type="button"
            class="flex-1 truncate text-left text-sm link-hover"
            @click="editing = { id: item.id, name: item.name }"
          >
            {{ item.name }}
          </button>
          <span class="text-xs text-muted">{{ t('tags.usage', { n: item.usage }) }}</span>
          <UButton
            icon="i-lucide-trash-2"
            size="xs"
            variant="ghost"
            color="neutral"
            :aria-label="t('common.delete')"
            @click="remove(item)"
          />
        </li>
      </ul>
    </template>
  </UModal>
</template>
