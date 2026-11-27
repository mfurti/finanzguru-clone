<script setup lang="ts">
import { PERIODS, type OwnerSettings } from '@finance/shared'

/** Settings › Anzeige (014 US2): start page, default period, colour mode, density, privacy. */
const { t } = useI18n()
useHead({ title: t('settings.display') })
const { settings, update } = useSettings()

const startPages = computed(() =>
  (['dashboard', 'transactions', 'budget'] as const).map((value) => ({
    label: t(`settings.displayPage.start.${value}`),
    value,
  })),
)
const periods = computed(() => PERIODS.map((value) => ({ label: t(`period.${value}`), value })))
const colorModes = computed(() =>
  (['system', 'light', 'dark'] as const).map((value) => ({
    label: t(`settings.displayPage.color.${value}`),
    value,
  })),
)
const densities = computed(() =>
  (['normal', 'compact'] as const).map((value) => ({
    label: t(`settings.displayPage.density.${value}`),
    value,
  })),
)

function set<K extends keyof OwnerSettings>(key: K, value: OwnerSettings[K]): void {
  void update({ [key]: value })
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('settings.display') }}</h1>
    <UCard>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField :label="t('settings.displayPage.startPage')">
          <USelect
            :model-value="settings.startPage"
            :items="startPages"
            class="w-full"
            data-testid="setting-start-page"
            @update:model-value="set('startPage', $event as OwnerSettings['startPage'])"
          />
        </UFormField>
        <UFormField :label="t('settings.displayPage.defaultPeriod')">
          <USelect
            :model-value="settings.defaultPeriod"
            :items="periods"
            class="w-full"
            data-testid="setting-default-period"
            @update:model-value="set('defaultPeriod', $event as OwnerSettings['defaultPeriod'])"
          />
        </UFormField>
        <UFormField :label="t('settings.displayPage.colorMode')">
          <USelect
            :model-value="settings.colorMode"
            :items="colorModes"
            class="w-full"
            data-testid="setting-color-mode"
            @update:model-value="set('colorMode', $event as OwnerSettings['colorMode'])"
          />
        </UFormField>
        <UFormField :label="t('settings.displayPage.densityLabel')">
          <USelect
            :model-value="settings.density"
            :items="densities"
            class="w-full"
            data-testid="setting-density"
            @update:model-value="set('density', $event as OwnerSettings['density'])"
          />
        </UFormField>
      </div>
      <USwitch
        class="mt-4"
        :model-value="settings.privacyMode"
        :label="t('settings.displayPage.privacy')"
        :description="t('settings.displayPage.privacyHint')"
        data-testid="setting-privacy"
        @update:model-value="set('privacyMode', $event)"
      />
    </UCard>
  </section>
</template>
