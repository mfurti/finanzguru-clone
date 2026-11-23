<script setup lang="ts">
/** Portfolios & Konten: all depots and accounts with balances, add a manual account. */
const { t } = useI18n()
useHead({ title: t('overview.views.accounts') })
const accountOpen = ref(false)
</script>

<template>
  <OverviewSection>
    <section class="space-y-4">
      <div class="flex items-center justify-between gap-2">
        <h1 class="text-xl font-bold">{{ t('overview.views.accounts') }}</h1>
        <UButton
          icon="i-lucide-plus"
          :label="t('add.account')"
          data-testid="accounts-add"
          @click="accountOpen = true"
        />
      </div>
      <AccountsCard />
      <AccountFormModal v-model:open="accountOpen" />
    </section>
  </OverviewSection>
</template>
