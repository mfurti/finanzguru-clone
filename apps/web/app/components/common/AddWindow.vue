<script setup lang="ts">
/**
 * "Was möchtest du hinzufügen?" like the reference (007 US5, research R7): tabs Anbieter and
 * Assets; providers searchable by name, IBAN or BIC; step 2 "Wie möchtest du importieren?"
 * links to the existing flows (bank connection, Scalable, CSV upload, account form).
 */
type Method = 'automatic' | 'file' | 'manual'
interface Provider {
  key: string
  name: string
  hint: string
  icon: string
  /** BIC prefixes and German bank codes (IBAN positions 5–12) that find this provider. */
  codes: string[]
  methods: Partial<Record<Method, string>>
}

const { t } = useI18n()
const open = ref(false)
const tab = ref<'providers' | 'assets'>('providers')
const query = ref('')
const chosen = ref<Provider | null>(null)
const accountOpen = ref(false)
const transactionOpen = ref(false)

/** Supported providers; "automatic" for banks goes through the PSD2 bank connection. */
const PROVIDERS = computed<Provider[]>(() => [
  {
    key: 'sparkasse',
    name: 'Sparkasse',
    hint: t('addWindow.automaticHint'),
    icon: 'i-lucide-landmark',
    codes: [],
    methods: {
      automatic: '/settings/sources#bank',
      file: '/settings/sources#csv',
      manual: 'account',
    },
  },
  {
    key: 'scalable',
    name: 'Scalable Capital',
    hint: t('addWindow.automaticHint'),
    icon: 'i-lucide-chart-candlestick',
    codes: ['SCFB'],
    methods: {
      automatic: '/settings/sources#scalable',
      file: '/settings/sources#csv',
      manual: 'account',
    },
  },
  {
    key: 'bank',
    name: t('add.otherBank'),
    hint: t('addWindow.automaticHint'),
    icon: 'i-lucide-building-2',
    codes: ['*'],
    methods: {
      automatic: '/settings/sources#bank',
      file: '/settings/sources#csv',
      manual: 'account',
    },
  },
])

const normalized = computed(() => query.value.replace(/\s+/g, '').toUpperCase())
/** IBAN or BIC typed: every bank qualifies (the bank connection asks for the bank). */
const looksLikeCode = computed(
  () =>
    /^[A-Z]{2}\d{2}[A-Z0-9]{4,}$/.test(normalized.value) ||
    /^[A-Z]{6}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/.test(normalized.value),
)
const providers = computed(() => {
  const text = query.value.trim().toLowerCase()
  if (!text) return PROVIDERS.value
  return PROVIDERS.value.filter(
    (provider) =>
      provider.name.toLowerCase().includes(text) ||
      (looksLikeCode.value &&
        provider.codes.some((code) => code === '*' || normalized.value.startsWith(code))),
  )
})

const methods = computed(() =>
  (['automatic', 'file', 'manual'] as const).map((method) => ({
    method,
    target: chosen.value?.methods[method],
    label: t(`addWindow.${method === 'manual' ? 'manualImport' : method}`),
    hint: t(`addWindow.${method === 'manual' ? 'manual' : method}Hint`),
    icon:
      method === 'automatic'
        ? 'i-lucide-refresh-cw'
        : method === 'file'
          ? 'i-lucide-file-up'
          : 'i-lucide-pencil',
  })),
)

watch(open, (value) => {
  if (!value) return
  tab.value = 'providers'
  query.value = ''
  chosen.value = null
})

async function go(target: string | undefined): Promise<void> {
  if (!target) return
  open.value = false
  if (target === 'account') accountOpen.value = true
  else if (target === 'transaction') transactionOpen.value = true
  else await navigateTo(target)
}
</script>

<template>
  <UButton
    icon="i-lucide-plus"
    size="sm"
    :aria-label="t('add.button')"
    data-testid="add-menu"
    @click="open = true"
  >
    <span class="hidden sm:inline">{{ t('add.button') }}</span>
  </UButton>

  <UModal v-model:open="open" :title="t('addWindow.title')" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <div class="space-y-4" data-testid="add-window">
        <template v-if="!chosen">
          <UTabs
            v-model="tab"
            :items="[
              { label: t('addWindow.providers'), value: 'providers' },
              { label: t('addWindow.assets'), value: 'assets' },
            ]"
            :content="false"
            size="sm"
          />

          <template v-if="tab === 'providers'">
            <UInput
              v-model="query"
              icon="i-lucide-search"
              :placeholder="t('addWindow.search')"
              class="w-full"
              autofocus
              data-testid="add-search"
            />
            <section>
              <h3 v-if="!query" class="mb-2 text-xs font-medium text-muted uppercase">
                {{ t('addWindow.popular') }}
              </h3>
              <div class="grid gap-2 sm:grid-cols-2">
                <button
                  v-for="provider in providers"
                  :key="provider.key"
                  type="button"
                  class="flex items-center gap-3 rounded-lg border border-default p-3 text-left transition-colors hover:bg-elevated"
                  :data-testid="`add-provider-${provider.key}`"
                  @click="chosen = provider"
                >
                  <UIcon :name="provider.icon" class="size-6 shrink-0 text-muted" />
                  <span class="min-w-0">
                    <span class="block font-medium">{{ provider.name }}</span>
                    <span class="block truncate text-xs text-muted">{{ provider.hint }}</span>
                  </span>
                </button>
              </div>
              <p v-if="providers.length === 0" class="py-3 text-sm text-muted">
                {{ t('addWindow.unsupported') }}
              </p>
            </section>
            <UButton
              variant="link"
              color="neutral"
              icon="i-lucide-plus"
              :label="t('addWindow.manual')"
              data-testid="add-manual"
              @click="go('account')"
            />
          </template>

          <div v-else class="grid gap-2 sm:grid-cols-3" data-testid="add-assets">
            <button
              v-for="asset in [
                { key: 'account', icon: 'i-lucide-landmark', label: t('add.account') },
                { key: 'transaction', icon: 'i-lucide-receipt-euro', label: t('add.transaction') },
                {
                  key: '/investments/watchlists',
                  icon: 'i-lucide-search',
                  label: t('addWindow.securities'),
                },
              ]"
              :key="asset.key"
              type="button"
              class="flex flex-col items-center gap-2 rounded-lg border border-default p-4 text-sm transition-colors hover:bg-elevated"
              @click="go(asset.key)"
            >
              <UIcon :name="asset.icon" class="size-6 text-muted" />
              {{ asset.label }}
            </button>
          </div>
        </template>

        <template v-else>
          <UButton
            variant="ghost"
            color="neutral"
            size="sm"
            icon="i-lucide-arrow-left"
            :label="t('addWindow.back')"
            @click="chosen = null"
          />
          <h3 class="font-semibold" data-testid="add-how">
            {{ t('addWindow.how') }}
            <span class="font-normal text-muted">· {{ chosen.name }}</span>
          </h3>
          <div class="grid gap-2">
            <button
              v-for="item in methods"
              :key="item.method"
              type="button"
              class="flex items-center gap-3 rounded-lg border border-default p-3 text-left transition-colors enabled:hover:bg-elevated disabled:opacity-50"
              :disabled="!item.target"
              :data-testid="`add-method-${item.method}`"
              @click="go(item.target)"
            >
              <UIcon :name="item.icon" class="size-5 shrink-0 text-muted" />
              <span>
                <span class="block font-medium">{{ item.label }}</span>
                <span class="block text-xs text-muted">{{
                  item.target ? item.hint : t('addWindow.unsupported')
                }}</span>
              </span>
            </button>
          </div>
        </template>
      </div>
    </template>
  </UModal>
  <AccountFormModal v-model:open="accountOpen" />
  <TransactionFormModal v-model:open="transactionOpen" />
</template>
