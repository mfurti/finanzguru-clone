<script setup lang="ts">
/** Copies a value to the clipboard and confirms with a short toast. */
const props = defineProps<{ value: string; label?: string }>()
const { t } = useI18n()
const toast = useToast()
const done = ref(false)
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(props.value)
    done.value = true
    toast.add({ title: t('accountsOverview.copied'), icon: 'i-lucide-check', duration: 1500 })
    setTimeout(() => (done.value = false), 1500)
  } catch {
    toast.add({ title: t('common.error'), color: 'error' })
  }
}
</script>

<template>
  <UButton
    :icon="done ? 'i-lucide-check' : 'i-lucide-copy'"
    size="xs"
    variant="ghost"
    color="neutral"
    :aria-label="label ?? t('refine.copy')"
    data-testid="copy-button"
    @click.stop.prevent="copy"
  />
</template>
