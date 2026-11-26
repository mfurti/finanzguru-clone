<script setup lang="ts">
import type { InflationRates } from '@finance/shared'
import type { FetchError } from 'ofetch'

/** Yearly inflation for the real return on the Analyse page (US1). */
const { t } = useI18n()
const toast = useToast()
useHead({ title: t('settings.inflation') })

const { data } = await useApi<InflationRates>('/api/settings/inflation', { default: () => [] })
const rows = ref<{ year: number; pct: number }[]>([])
watch(
  data,
  (value) => {
    rows.value = (value ?? []).map((r) => ({
      year: r.year,
      pct: Math.round(Number(r.rate) * 10000) / 100,
    }))
  },
  { immediate: true },
)
const error = ref<string | null>(null)

function add(): void {
  const last = rows.value.reduce((max, r) => Math.max(max, r.year), new Date().getFullYear() - 1)
  rows.value.push({ year: last + 1, pct: 2 })
}

async function save(): Promise<void> {
  error.value = null
  try {
    data.value = await apiFetch<InflationRates>('/api/settings/inflation', {
      method: 'PUT',
      body: {
        rates: rows.value.map((r) => ({
          year: r.year,
          rate: String(Math.round(r.pct * 100) / 10000),
        })),
      },
    })
    toast.add({ title: t('common.save'), color: 'success' })
  } catch (cause) {
    error.value =
      (cause as FetchError).data?.data?.issues?.[0]?.message ??
      (cause as FetchError).data?.statusMessage ??
      String(cause)
  }
}
</script>

<template>
  <section class="space-y-4">
    <div class="flex items-center justify-between gap-2">
      <h1 class="text-xl font-semibold">{{ t('settings.inflation') }}</h1>
      <UButton
        to="/settings/sources"
        variant="soft"
        color="neutral"
        icon="i-lucide-database"
        :label="t('settings.sources')"
      />
    </div>
    <UCard>
      <div class="space-y-2" data-testid="inflation-rows">
        <div v-for="(row, index) in rows" :key="index" class="flex items-center gap-2">
          <UInputNumber
            v-model="row.year"
            :min="1990"
            :max="2100"
            :format-options="{ useGrouping: false }"
            class="w-32"
          />
          <UInputNumber v-model="row.pct" :min="-10" :max="50" :step="0.1" class="w-32" />
          <span class="text-sm text-muted">%</span>
          <UButton
            icon="i-lucide-x"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="t('common.delete')"
            @click="rows.splice(index, 1)"
          />
        </div>
        <div class="flex gap-2 pt-2">
          <UButton variant="soft" icon="i-lucide-plus" :label="t('common.add')" @click="add" />
          <UButton icon="i-lucide-check" :label="t('common.save')" @click="save" />
        </div>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
      </div>
    </UCard>
  </section>
</template>
