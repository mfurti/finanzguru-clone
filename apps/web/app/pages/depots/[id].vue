<script setup lang="ts">
/** Depot detail (003 US2): value history, positions and bookings of this depot only. */
definePageMeta({ layout: 'overview' })
const route = useRoute()
const id = computed(() => String(route.params.id))
const filters = computed(() => ({ accounts: id.value }))
</script>

<template>
  <AccountDetail :id="id">
    <PositionsTable :accounts="id" />
    <UCard>
      <template #header>
        <h2>{{ $t('accountsOverview.bookings') }}</h2>
      </template>
      <TransactionsTable :filters="filters" />
    </UCard>
  </AccountDetail>
</template>
