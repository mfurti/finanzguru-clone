<script setup lang="ts">
/** The review list moved to Übersicht › Transaktionen (003 FR-001); old links land there. */
await navigateTo({ path: '/transactions', query: { review: 'unreviewed' } }, { replace: true })
</script>

<template>
  <div />
</template>
