<script setup lang="ts">
import type { CsvMappingInput } from '@finance/shared'

/** Manual column mapping for an unknown CSV layout (FR-051). */
const props = defineProps<{
  headers: string[]
  preview: string[][]
  delimiter: string
  encoding: string
}>()
const mapping = defineModel<CsvMappingInput>({ required: true })
const saveAs = defineModel<string>('saveAs', { default: '' })
const { t } = useI18n()

const FIELDS = [
  'date',
  'amount',
  'counterparty',
  'purpose',
  'iban',
  'valueDate',
  'isin',
  'quantity',
  'price',
  'fee',
  'tax',
  'type',
] as const
type Field = (typeof FIELDS)[number]
const REQUIRED = new Set<Field>(['date', 'amount'])

const columnItems = computed(() => [
  { label: t('import.mapping.none'), value: -1 },
  ...props.headers.map((header, index) => ({ label: header || `#${index + 1}`, value: index })),
])

function columnOf(field: Field): number {
  return (mapping.value.columns as Record<string, number | undefined>)[field] ?? -1
}
function setColumn(field: Field, value: number): void {
  // Unused columns are left out entirely (the API rejects negative indexes).
  const columns = Object.fromEntries(
    Object.entries({ ...mapping.value.columns, [field]: value }).filter(
      ([, index]) => typeof index === 'number' && index >= 0,
    ),
  )
  mapping.value = { ...mapping.value, columns: columns as CsvMappingInput['columns'] }
}

/** Guess date/amount/counterparty/purpose from header names on first show. */
onMounted(() => {
  const guess = (pattern: RegExp) => props.headers.findIndex((header) => pattern.test(header))
  const guesses: Partial<Record<Field, number>> = {
    date: guess(/datum|date|buchung/i),
    amount: guess(/betrag|amount|summe|wert/i),
    counterparty: guess(/empf|zahlungs|counterparty|name|partner/i),
    purpose: guess(/zweck|purpose|beschreibung|text|memo/i),
    iban: guess(/iban/i),
    isin: guess(/isin/i),
  }
  // One model update: consecutive v-model writes would overwrite each other.
  const columns = { ...mapping.value.columns } as Record<string, number | undefined>
  for (const [field, index] of Object.entries(guesses)) {
    if (index !== undefined && index >= 0 && (columns[field] ?? -1) < 0) columns[field] = index
  }
  // Date format and decimal separator from the first preview row.
  const first = props.preview[0] ?? []
  const dateCell = (columns.date ?? -1) >= 0 ? (first[columns.date!] ?? '') : ''
  const amountCell = (columns.amount ?? -1) >= 0 ? (first[columns.amount!] ?? '') : ''
  let dateFormat = mapping.value.dateFormat
  if (/^\d{4}-\d{2}-\d{2}/.test(dateCell)) dateFormat = 'YYYY-MM-DD'
  else if (/^\d{1,2}\.\d{1,2}\.\d{2}$/.test(dateCell)) dateFormat = 'DD.MM.YY'
  else if (/^\d{1,2}\.\d{1,2}\.\d{4}$/.test(dateCell)) dateFormat = 'DD.MM.YYYY'
  let decimalSeparator = mapping.value.decimalSeparator
  if (/,\d{1,2}$/.test(amountCell)) decimalSeparator = ','
  else if (/\.\d{1,2}$/.test(amountCell)) decimalSeparator = '.'
  mapping.value = {
    ...mapping.value,
    dateFormat,
    decimalSeparator,
    columns: columns as CsvMappingInput['columns'],
  }
})

const optionItems = {
  dateFormat: ['DD.MM.YYYY', 'DD.MM.YY', 'YYYY-MM-DD'],
  decimalSeparator: [
    { label: t('import.mapping.comma'), value: ',' },
    { label: t('import.mapping.dot'), value: '.' },
  ],
  delimiter: [
    { label: ';', value: ';' },
    { label: ',', value: ',' },
    { label: 'Tab', value: '\t' },
  ],
  encoding: [
    { label: 'UTF-8', value: 'utf-8' },
    { label: 'Windows-1252', value: 'windows-1252' },
  ],
}
</script>

<template>
  <div class="space-y-4" data-testid="column-mapper">
    <div class="overflow-x-auto rounded-md border border-default">
      <table class="w-full text-xs">
        <thead>
          <tr class="bg-elevated">
            <th
              v-for="(header, index) in headers"
              :key="index"
              class="px-2 py-1 text-left font-medium"
            >
              {{ header }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(row, index) in preview.slice(0, 5)"
            :key="index"
            class="border-t border-default"
          >
            <td v-for="(value, column) in row" :key="column" class="whitespace-nowrap px-2 py-1">
              {{ value }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField
        v-for="field in FIELDS"
        :key="field"
        :label="t(`import.fields.${field}`)"
        :required="REQUIRED.has(field)"
      >
        <USelect
          :model-value="columnOf(field)"
          :items="columnItems"
          class="w-full"
          :data-testid="`map-${field}`"
          @update:model-value="(value) => setColumn(field, Number(value))"
        />
      </UFormField>
    </div>

    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField :label="t('import.mapping.dateFormat')">
        <USelect v-model="mapping.dateFormat" :items="optionItems.dateFormat" class="w-full" />
      </UFormField>
      <UFormField :label="t('import.mapping.decimal')">
        <USelect
          v-model="mapping.decimalSeparator"
          :items="optionItems.decimalSeparator"
          class="w-full"
        />
      </UFormField>
      <UFormField :label="t('import.mapping.delimiter')">
        <USelect v-model="mapping.delimiter" :items="optionItems.delimiter" class="w-full" />
      </UFormField>
      <UFormField :label="t('import.mapping.encoding')">
        <USelect v-model="mapping.encoding" :items="optionItems.encoding" class="w-full" />
      </UFormField>
      <UFormField :label="t('import.mapping.skipRows')">
        <UInputNumber v-model="mapping.skipRows" :min="0" :max="50" class="w-full" />
      </UFormField>
      <UFormField :label="t('import.mapping.saveAs')" :hint="t('import.mapping.saveHint')">
        <UInput v-model="saveAs" class="w-full" data-testid="mapping-save-as" />
      </UFormField>
    </div>
  </div>
</template>
