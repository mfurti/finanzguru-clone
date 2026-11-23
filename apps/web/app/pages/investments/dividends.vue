<script setup lang="ts">
import type { DividendCalendarEntry, DividendSummary } from '@finance/shared'

const { t } = useI18n()
useHead({ title: t('dividends.title') })
const { accountsParam } = useAccountFilter()

const { data: summary } = await useApi<DividendSummary>('/api/dividends/summary', {
  query: { accounts: accountsParam },
})
const { data: calendar, refresh: refreshCalendar } = await useApi<DividendCalendarEntry[]>(
  '/api/dividends/calendar',
  { query: { accounts: accountsParam }, default: () => [] },
)

const formOpen = ref(false)
const editing = ref<DividendCalendarEntry | null>(null)
function add(): void {
  editing.value = null
  formOpen.value = true
}
function edit(entry: DividendCalendarEntry): void {
  editing.value = entry
  formOpen.value = true
}
async function remove(entry: DividendCalendarEntry): Promise<void> {
  if (!entry.id) return
  await apiFetch(`/api/dividends/expected/${entry.id}`, { method: 'DELETE' })
  await refreshCalendar()
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('nav.investments') }}</h1>
    <InvestmentsNav />
    <template v-if="summary">
      <DividendSummary :summary="summary" />
      <div class="grid gap-4 lg:grid-cols-2">
        <UCard>
          <template #header>
            <h2 class="font-semibold">{{ t('dividends.history') }}</h2>
          </template>
          <EmptyState
            v-if="summary.years.length === 0"
            :title="t('dividends.empty')"
            icon="i-lucide-coins"
          />
          <DividendHistory v-else :years="summary.years" />
        </UCard>
        <UCard>
          <template #header>
            <h2 class="font-semibold">{{ t('dividends.bySecurity') }}</h2>
          </template>
          <p v-if="summary.bySecurity.length === 0" class="text-sm text-muted">
            {{ t('dividends.empty') }}
          </p>
          <ul v-else class="divide-y divide-default text-sm" data-testid="dividends-by-security">
            <li
              v-for="row in summary.bySecurity"
              :key="row.instrumentId"
              class="row-hover flex items-center justify-between gap-3 py-2"
            >
              <NuxtLink
                :to="`/investments/${row.instrumentId}`"
                class="link-hover min-w-0 truncate"
              >
                {{ row.name }}
              </NuxtLink>
              <span class="flex shrink-0 gap-3">
                <Percent :value="row.pct" class="text-muted" />
                <Money :cents="row.cents" />
              </span>
            </li>
          </ul>
        </UCard>
      </div>
    </template>
    <UCard>
      <template #header>
        <div class="flex items-center justify-between gap-2">
          <h2 class="font-semibold">{{ t('dividends.calendar') }}</h2>
          <UButton
            size="sm"
            icon="i-lucide-plus"
            :label="t('dividends.addExpected')"
            data-testid="expected-add"
            @click="add"
          />
        </div>
      </template>
      <DividendCalendar :entries="calendar ?? []" @edit="edit" @remove="remove" />
    </UCard>
    <ExpectedForm v-model:open="formOpen" :entry="editing" @saved="refreshCalendar()" />
  </section>
</template>
