<script setup lang="ts">
import type { BrandSearchResult, LogoRef, LogoSource } from '@finance/shared'
import { FetchError } from 'ofetch'

/**
 * "Logo ändern" (008 US2): search the built-in brand logos and pick one, or choose
 * "Automatisch" / "Kein Logo". The choice applies to all bookings of the recipient.
 */
const props = defineProps<{
  recipientKey: string
  name: string
  logo: LogoRef
  logoSource: LogoSource
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ saved: [] }>()
const { t } = useI18n()
const toast = useToast()

const query = ref('')
const results = ref<BrandSearchResult[]>([])
const busy = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function search(): Promise<void> {
  results.value = await apiFetch<BrandSearchResult[]>('/api/logos/brands', {
    query: { q: query.value.trim(), limit: 40 },
  })
}
watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(() => void search(), 200)
})
watch(
  open,
  (value) => {
    if (!value) return
    query.value = ''
    void search()
  },
  { immediate: true },
)
onBeforeUnmount(() => clearTimeout(timer))

const path = computed(() => `/api/logos/recipients/${encodeURIComponent(props.recipientKey)}`)
const currentSlug = computed(() => (props.logo?.kind === 'brand' ? props.logo.slug : null))

async function run(action: () => Promise<unknown>): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    await action()
    toast.add({ title: t('logo.saved'), color: 'success' })
    emit('saved')
    open.value = false
  } catch (error) {
    const message =
      error instanceof FetchError ? (error.data?.message ?? error.statusMessage) : undefined
    toast.add({ title: t('common.error'), description: message, color: 'error' })
  } finally {
    busy.value = false
  }
}
const choose = (slug: string) =>
  run(() => apiFetch(path.value, { method: 'PUT', body: { mode: 'brand', brandSlug: slug } }))
const none = () => run(() => apiFetch(path.value, { method: 'PUT', body: { mode: 'none' } }))
const automatic = () => run(() => apiFetch(path.value, { method: 'DELETE' }))
</script>

<template>
  <UModal v-model:open="open" :title="t('logo.title')" :ui="{ content: 'sm:max-w-xl' }">
    <template #body>
      <div class="space-y-4" data-testid="logo-picker">
        <p class="text-sm text-muted">{{ t('logo.appliesAll', { name }) }}</p>
        <UInput
          v-model="query"
          icon="i-lucide-search"
          :placeholder="t('logo.search')"
          class="w-full"
          autofocus
          data-testid="logo-search"
        />
        <div
          class="grid max-h-72 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4"
          data-testid="logo-results"
        >
          <button
            v-for="brand in results"
            :key="brand.slug"
            type="button"
            class="flex flex-col items-center gap-1.5 rounded-lg border p-2 text-xs transition-colors hover:bg-elevated"
            :class="currentSlug === brand.slug ? 'border-primary' : 'border-default'"
            :aria-pressed="currentSlug === brand.slug"
            :data-testid="`logo-option-${brand.slug}`"
            :disabled="busy"
            @click="choose(brand.slug)"
          >
            <MerchantLogo :name="brand.title" :logo="{ kind: 'brand', ...brand }" size="md" />
            <span class="w-full truncate text-center">{{ brand.title }}</span>
          </button>
          <p v-if="results.length === 0" class="col-span-full py-4 text-center text-sm text-muted">
            {{ t('logo.noResults') }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            variant="soft"
            color="neutral"
            icon="i-lucide-wand-sparkles"
            :label="t('logo.auto')"
            :disabled="busy"
            data-testid="logo-auto"
            @click="automatic"
          />
          <UButton
            variant="soft"
            color="neutral"
            icon="i-lucide-circle-slash"
            :label="t('logo.none')"
            :disabled="busy"
            data-testid="logo-none"
            @click="none"
          />
          <slot name="upload" />
          <span v-if="logoSource === 'auto'" class="ml-auto text-xs text-muted">
            {{ t('logo.autoDetected') }}
          </span>
        </div>
      </div>
    </template>
  </UModal>
</template>
