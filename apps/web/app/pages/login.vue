<script setup lang="ts">
import type { FetchError } from 'ofetch'

definePageMeta({ layout: false })

const { t } = useI18n()
useHead({ title: t('login.title') })

const route = useRoute()
const password = ref('')
const error = ref<string | null>(null)
const loading = ref(false)

async function submit(): Promise<void> {
  error.value = null
  loading.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { password: password.value } })
    useState('session').value = null
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await navigateTo(redirect.startsWith('/') && !redirect.startsWith('//') ? redirect : '/')
  } catch (cause) {
    const status = (cause as FetchError).statusCode
    error.value = status === 429 ? t('login.tooMany') : t('login.wrong')
    password.value = ''
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-dvh items-center justify-center bg-default px-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <BrandLogo />
      </template>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField :label="t('login.password')" name="password">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            required
            autofocus
            class="w-full"
            data-testid="login-password"
          />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" icon="i-lucide-lock" />
        <UButton type="submit" block :loading="loading" :label="t('login.submit')" />
      </form>
    </UCard>
  </div>
</template>
