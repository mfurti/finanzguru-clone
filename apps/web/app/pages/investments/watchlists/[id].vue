<script setup lang="ts">
/** Old watchlist links open the tab on the Watchlist page (012 P10). */
const route = useRoute()
await navigateTo(
  { path: '/investments/watchlists', query: { ...route.query, id: String(route.params.id) } },
  { replace: true },
)
</script>

<template>
  <div />
</template>
