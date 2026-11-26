<script setup lang="ts">
/** Account detail (003 US2): history, figures and this account's bookings. */
definePageMeta({ layout: 'overview' })
const route = useRoute()
const id = computed(() => String(route.params.id))
</script>

<template>
  <AccountDetail :id="id">
    <BookingsTable :fixed="{ accounts: id }" compact />
  </AccountDetail>
</template>
