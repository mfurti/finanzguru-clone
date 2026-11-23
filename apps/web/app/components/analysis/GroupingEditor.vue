<script setup lang="ts">
import type { GroupingDto, PositionDto } from '@finance/shared'
import type { FetchError } from 'ofetch'

/** Create, rename and fill own groupings ("Eigene Aufteilung", US1). */
const props = defineProps<{ groupings: GroupingDto[] }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [id?: string] }>()
const { t } = useI18n()

const NEW = 'new'
const NONE = 'none'
const selectedId = ref<string>(NEW)
const name = ref('')
const groupsText = ref('')
const assignment = ref<Record<string, string>>({})
const busy = ref(false)
const error = ref<string | null>(null)

const { data: positions } = await useApi<PositionDto[]>('/api/investments/positions', {
  key: 'grouping-positions',
  default: () => [],
})

const current = computed(() => props.groupings.find((g) => g.id === selectedId.value))
const groupNames = computed(() =>
  groupsText.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean),
)

function load(): void {
  const grouping = current.value
  name.value = grouping?.name ?? ''
  groupsText.value = grouping ? grouping.groups.map((g) => g.name).join('\n') : ''
  const next: Record<string, string> = {}
  for (const position of positions.value ?? []) {
    const member = grouping?.members.find((m) => m.instrumentId === position.instrumentId)
    const group = grouping?.groups.find((g) => g.id === member?.groupId)
    next[position.instrumentId] = group?.name ?? NONE
  }
  assignment.value = next
}
watch([open, selectedId], () => open.value && load(), { immediate: true })

const groupingItems = computed(() => [
  { label: t('analysis.grouping.new'), value: NEW },
  ...props.groupings.map((g) => ({ label: g.name, value: g.id })),
])
const groupItems = computed(() => [
  { label: t('analysis.grouping.noGroup'), value: NONE },
  ...groupNames.value.map((group) => ({ label: group, value: group })),
])

async function save(): Promise<void> {
  busy.value = true
  error.value = null
  try {
    const body = { name: name.value.trim(), groups: groupNames.value }
    const saved = current.value
      ? await apiFetch<GroupingDto>(`/api/groupings/${current.value.id}`, { method: 'PATCH', body })
      : await apiFetch<GroupingDto>('/api/groupings', { method: 'POST', body })
    const ids = new Map(saved.groups.map((g) => [g.name, g.id]))
    await apiFetch(`/api/groupings/${saved.id}/members`, {
      method: 'PUT',
      body: {
        members: Object.entries(assignment.value).map(([instrumentId, group]) => ({
          instrumentId,
          groupId: ids.get(group) ?? null,
        })),
      },
    })
    emit('saved', saved.id)
    open.value = false
  } catch (cause) {
    error.value =
      (cause as FetchError).data?.data?.issues?.[0]?.message ??
      (cause as FetchError).data?.statusMessage ??
      String(cause)
  } finally {
    busy.value = false
  }
}

async function remove(): Promise<void> {
  if (!current.value) return
  await apiFetch(`/api/groupings/${current.value.id}`, { method: 'DELETE' })
  selectedId.value = NEW
  emit('saved')
  open.value = false
}
</script>

<template>
  <UModal v-model:open="open" :title="t('analysis.grouping.manage')">
    <template #body>
      <div class="space-y-4" data-testid="grouping-editor">
        <USelect v-model="selectedId" :items="groupingItems" class="w-full" />
        <UFormField :label="t('analysis.grouping.name')" required>
          <UInput v-model="name" maxlength="60" class="w-full" data-testid="grouping-name" />
        </UFormField>
        <UFormField :label="t('analysis.grouping.groups')" required>
          <UTextarea v-model="groupsText" :rows="3" class="w-full" data-testid="grouping-groups" />
        </UFormField>
        <div v-if="(positions ?? []).length > 0" class="space-y-2">
          <div class="text-sm font-medium">{{ t('analysis.grouping.assign') }}</div>
          <div
            v-for="position in positions"
            :key="position.instrumentId"
            class="flex items-center justify-between gap-2 text-sm"
          >
            <span class="min-w-0 truncate">{{ position.name }}</span>
            <USelect
              v-model="assignment[position.instrumentId]"
              :items="groupItems"
              size="sm"
              class="w-40 shrink-0"
              :data-testid="`grouping-assign-${position.isin}`"
            />
          </div>
        </div>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
      </div>
    </template>
    <template #footer>
      <div class="flex w-full justify-between gap-2">
        <UButton
          v-if="current"
          color="error"
          variant="ghost"
          :label="t('common.delete')"
          @click="remove"
        />
        <span v-else />
        <div class="flex gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            :label="t('common.cancel')"
            @click="open = false"
          />
          <UButton
            :loading="busy"
            :disabled="!name.trim() || groupNames.length === 0"
            :label="t('common.save')"
            data-testid="grouping-save"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
