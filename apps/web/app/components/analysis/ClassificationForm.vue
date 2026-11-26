<script setup lang="ts">
import {
  type ClassificationDto,
  DIMENSION_KEYS,
  DIMENSION_LABELS,
  FUND_TYPE_LABELS,
  FUND_TYPES,
  type FundType,
  WEIGHT_DIMENSIONS,
  type WeightDimension,
} from '@finance/shared'
import type { FetchError } from 'ofetch'

/** Region/sector/currency weights, fund type and benchmark flag of one instrument (US1). */
const props = defineProps<{ instrumentId: string; isFund?: boolean }>()
const { t } = useI18n()
const toast = useToast()

const { data } = await useApi<ClassificationDto>(
  () => `/api/instruments/${props.instrumentId}/classification`,
)

/** Editable rows with whole-number percentages. */
type Row = { key: string; pct: number }
const rows = reactive<Record<WeightDimension, Row[]>>({ region: [], sector: [], currency: [] })
const fundType = ref<FundType | null>(null)
const isBenchmark = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

watch(
  data,
  (value) => {
    if (!value) return
    for (const dimension of WEIGHT_DIMENSIONS) {
      rows[dimension] = value.weights[dimension].map((w) => ({
        key: w.key,
        pct: Math.round(Number(w.weight) * 10000) / 100,
      }))
    }
    fundType.value = value.fundType
    isBenchmark.value = value.isBenchmark
  },
  { immediate: true },
)

const sums = computed(
  () =>
    Object.fromEntries(
      WEIGHT_DIMENSIONS.map((d) => [d, rows[d].reduce((sum, row) => sum + (row.pct || 0), 0)]),
    ) as Record<WeightDimension, number>,
)
const invalid = computed(() => WEIGHT_DIMENSIONS.some((d) => sums.value[d] > 100.0001))

const keyItems = (dimension: WeightDimension) =>
  DIMENSION_KEYS[dimension].map((key) => ({
    label: DIMENSION_LABELS[dimension][key] ?? key,
    value: key,
  }))
const fundItems = [
  { label: '–', value: 'none' },
  ...FUND_TYPES.map((type) => ({ label: FUND_TYPE_LABELS[type], value: type })),
]
const fundModel = computed({
  get: () => fundType.value ?? 'none',
  set: (value: string) => (fundType.value = value === 'none' ? null : (value as FundType)),
})

function addRow(dimension: WeightDimension): void {
  const used = new Set(rows[dimension].map((r) => r.key))
  const next = DIMENSION_KEYS[dimension].find((key) => !used.has(key))
  if (next) rows[dimension].push({ key: next, pct: Math.max(0, 100 - sums.value[dimension]) })
}

const pctLabel = (value: number) =>
  `${value.toLocaleString('de-DE', { maximumFractionDigits: 2 })} %`

async function save(): Promise<void> {
  saving.value = true
  error.value = null
  try {
    const weights = Object.fromEntries(
      WEIGHT_DIMENSIONS.map((d) => [
        d,
        rows[d]
          .filter((row) => row.pct > 0)
          .map((row) => ({ key: row.key, weight: String(Math.round(row.pct * 100) / 10000) })),
      ]),
    )
    data.value = await apiFetch<ClassificationDto>(
      `/api/instruments/${props.instrumentId}/classification`,
      {
        method: 'PUT',
        body: { fundType: fundType.value, isBenchmark: isBenchmark.value, weights },
      },
    )
    toast.add({ title: t('analysis.classification.saved'), color: 'success' })
  } catch (cause) {
    error.value = (cause as FetchError).data?.statusMessage ?? String(cause)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard data-testid="classification-form">
    <template #header>
      <h2 class="font-semibold">{{ t('analysis.classification.title') }}</h2>
    </template>
    <div class="space-y-5">
      <div v-for="dimension in WEIGHT_DIMENSIONS" :key="dimension" class="space-y-2">
        <div class="flex items-center justify-between text-sm">
          <span class="font-medium">{{ t(`analysis.dimensions.${dimension}`) }}</span>
          <span
            :class="sums[dimension] > 100.0001 ? 'text-error' : 'text-muted'"
            :data-testid="`sum-${dimension}`"
          >
            {{
              sums[dimension] > 100.0001
                ? t('analysis.classification.sumTooHigh', { sum: pctLabel(sums[dimension]) })
                : t('analysis.classification.sum', { sum: pctLabel(sums[dimension]) })
            }}
          </span>
        </div>
        <div v-for="(row, index) in rows[dimension]" :key="index" class="flex items-center gap-2">
          <USelect
            v-model="row.key"
            :items="keyItems(dimension)"
            class="min-w-0 flex-1"
            :data-testid="`weight-key-${dimension}-${index}`"
          />
          <UInputNumber
            v-model="row.pct"
            :min="0"
            :max="100"
            :step="1"
            size="sm"
            class="w-28"
            :data-testid="`weight-pct-${dimension}-${index}`"
          />
          <UButton
            icon="i-lucide-x"
            size="sm"
            variant="ghost"
            color="neutral"
            :aria-label="t('common.delete')"
            @click="rows[dimension].splice(index, 1)"
          />
        </div>
        <UButton
          size="xs"
          variant="ghost"
          icon="i-lucide-plus"
          :label="t('analysis.classification.add')"
          :data-testid="`weight-add-${dimension}`"
          @click="addRow(dimension)"
        />
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField v-if="isFund" :label="t('analysis.classification.fundType')">
          <USelect v-model="fundModel" :items="fundItems" class="w-full" />
        </UFormField>
        <USwitch
          v-model="isBenchmark"
          :label="t('analysis.classification.benchmark')"
          class="self-end"
        />
      </div>

      <UAlert v-if="error" color="error" variant="subtle" :title="error" />
      <UButton
        :disabled="invalid"
        :loading="saving"
        icon="i-lucide-check"
        :label="t('common.save')"
        data-testid="classification-save"
        @click="save"
      />
    </div>
  </UCard>
</template>
