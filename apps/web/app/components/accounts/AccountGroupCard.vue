<script setup lang="ts">
import type { AccountsOverview, AccountType } from '@finance/shared'

/** "Depots" or "Konten" card with total and "+" (003 US2). */
const props = defineProps<{ group: AccountsOverview['groups'][number] }>()
const emit = defineEmits<{ add: [type: AccountType] }>()
const { t } = useI18n()
const title = computed(() =>
  props.group.kind === 'depot' ? t('accountsOverview.depots') : t('accountsOverview.accounts'),
)
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }" :data-testid="`account-group-${group.kind}`">
    <template #header>
      <div class="flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-2">
          {{ title }}
          <UButton
            icon="i-lucide-plus"
            size="xs"
            variant="soft"
            color="neutral"
            :aria-label="t('accountsOverview.add')"
            :data-testid="`account-group-add-${group.kind}`"
            @click="emit('add', group.kind === 'depot' ? 'depot' : 'checking')"
          />
        </h2>
        <Money :cents="group.totalCents" class="text-lg font-bold" />
      </div>
    </template>
    <ul class="divide-y divide-default">
      <AccountRow v-for="row in group.rows" :key="row.id" :row="row" />
    </ul>
  </UCard>
</template>
