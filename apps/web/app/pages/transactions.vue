<script setup lang="ts">
/**
 * Übersicht › Transaktionen (003 US1): balance and unreviewed tiles above the
 * full bookings workspace. Filters live in the URL, so the former review page
 * links here with `?review=unreviewed`.
 */
const { t } = useI18n()
useHead({ title: t('overview.views.transactions') })
const { state, set, filter } = useBookingQuery({ routeSync: true })
const table = useTemplateRef<{ refresh: () => Promise<void> }>('table')
</script>

<template>
  <OverviewSection>
    <section class="space-y-4">
      <h1 class="sr-only">{{ t('overview.views.transactions') }}</h1>
      <div class="grid gap-4 md:grid-cols-2">
        <BalanceTile />
        <UnreviewedTile
          :filter="filter"
          :only-unreviewed="state.review === 'unreviewed'"
          @toggle="(on) => set({ review: on ? 'unreviewed' : 'all' })"
          @done="table?.refresh()"
        />
      </div>
      <RuleSuggestions @changed="table?.refresh()" />
      <BookingsTable ref="table" route-sync />
    </section>
  </OverviewSection>
</template>
