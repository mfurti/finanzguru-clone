<script setup lang="ts">
import type { AccountDto, CsvMappingInput, CsvUploadResponse, ImportJobDto } from '@finance/shared'
import type { FetchError } from 'ofetch'

/** CSV import wizard: upload → (mapping) → confirm → result (US2). */
const emit = defineEmits<{ imported: [job: ImportJobDto] }>()
const { t } = useI18n()

const file = ref<File | null>(null)
const upload = ref<CsvUploadResponse | null>(null)
const result = ref<ImportJobDto | null>(null)
const error = ref<string | null>(null)
const busy = ref(false)
/** AUTO = match or create the account from the file (known layouts only). */
const AUTO = 'auto'
const accountId = ref<string>(AUTO)
const saveAs = ref('')
const mapping = ref<CsvMappingInput>({
  delimiter: ';',
  encoding: 'utf-8',
  dateFormat: 'DD.MM.YYYY',
  decimalSeparator: ',',
  skipRows: 0,
  columns: { date: -1, amount: -1 } as CsvMappingInput['columns'],
})

const { data: accounts } = await useApi<AccountDto[]>('/api/accounts', {
  key: 'accounts',
  default: () => [],
})
const accountItems = computed(() => [
  { label: t('import.autoAccount'), value: AUTO },
  ...(accounts.value ?? []).map((acc) => ({
    label: `${acc.name} · ${acc.institutionName}`,
    value: acc.id,
  })),
])

const canConfirm = computed(() => {
  if (!upload.value) return false
  if (!upload.value.needsMapping) return true
  const columns = mapping.value.columns
  return columns.date >= 0 && columns.amount >= 0 && accountId.value !== AUTO
})

function message(cause: unknown): string {
  return (cause as FetchError).data?.statusMessage ?? t('import.failed')
}

async function send(): Promise<void> {
  if (!file.value) return
  busy.value = true
  error.value = null
  result.value = null
  try {
    const form = new FormData()
    form.append('file', file.value, file.value.name)
    upload.value = await apiFetch<CsvUploadResponse>('/api/import/csv', {
      method: 'POST',
      body: form,
    })
    mapping.value = {
      ...mapping.value,
      delimiter: (upload.value.delimiter as CsvMappingInput['delimiter']) ?? ';',
      encoding: (upload.value.encoding as CsvMappingInput['encoding']) ?? 'utf-8',
    }
  } catch (cause) {
    error.value = message(cause)
  } finally {
    busy.value = false
  }
}

async function confirm(): Promise<void> {
  if (!upload.value) return
  busy.value = true
  error.value = null
  try {
    const body: Record<string, unknown> = {}
    if (accountId.value !== AUTO) body.accountId = accountId.value
    if (upload.value.needsMapping) {
      body.mapping = mapping.value
      if (saveAs.value.trim()) body.saveMappingAs = saveAs.value.trim()
    }
    result.value = await apiFetch<ImportJobDto>(`/api/import/csv/${upload.value.jobId}/confirm`, {
      method: 'POST',
      body,
    })
    upload.value = null
    file.value = null
    emit('imported', result.value)
    await refreshNuxtData()
  } catch (cause) {
    error.value = message(cause)
  } finally {
    busy.value = false
  }
}

function reset(): void {
  upload.value = null
  result.value = null
  error.value = null
  file.value = null
}
</script>

<template>
  <div class="space-y-4" data-testid="csv-upload">
    <template v-if="!upload">
      <UFileUpload
        v-model="file"
        accept=".csv,text/csv"
        :label="t('import.drop')"
        :description="t('import.dropHint')"
        class="w-full"
        data-testid="csv-file"
      />
      <UButton
        :disabled="!file"
        :loading="busy"
        icon="i-lucide-upload"
        :label="t('import.upload')"
        data-testid="csv-upload-button"
        @click="send"
      />
    </template>

    <template v-else>
      <p class="text-sm">
        <span v-if="upload.detectedFormat">
          {{ t('import.detected', { format: upload.detectedFormat }) }}
        </span>
        <span v-else>{{ t('import.unknownLayout') }}</span>
      </p>
      <UFormField :label="t('import.targetAccount')" :required="upload.needsMapping">
        <USelect
          v-model="accountId"
          :items="accountItems"
          class="w-full"
          data-testid="csv-target"
        />
      </UFormField>
      <ColumnMapper
        v-if="upload.needsMapping"
        v-model="mapping"
        v-model:save-as="saveAs"
        :headers="upload.headers"
        :preview="upload.preview"
        :delimiter="upload.delimiter"
        :encoding="upload.encoding"
      />
      <div class="flex gap-2">
        <UButton
          :disabled="!canConfirm"
          :loading="busy"
          icon="i-lucide-check"
          :label="t('import.confirm')"
          data-testid="csv-confirm"
          @click="confirm"
        />
        <UButton variant="ghost" color="neutral" :label="t('common.cancel')" @click="reset" />
      </div>
    </template>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      :title="error"
      icon="i-lucide-triangle-alert"
    />
    <ImportResult v-if="result" :job="result" />
  </div>
</template>
