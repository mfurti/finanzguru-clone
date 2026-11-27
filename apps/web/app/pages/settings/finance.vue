<script setup lang="ts">
import type { OwnerSettings } from '@finance/shared'

/** Settings › Finanzen & Steuern (014 US3). */
const { t } = useI18n()
useHead({ title: t('settings.finance') })
const { settings, update } = useSettings()

const assessments = computed(() =>
  (['single', 'joint'] as const).map((value) => ({
    label: t(`settings.financePage.assessment.${value}`),
    value,
  })),
)
const churchTaxes = computed(() =>
  (['none', 'BY', 'BW', 'other'] as const).map((value) => ({
    label: t(`settings.financePage.church.${value}`),
    value,
  })),
)
const roundings = computed(() =>
  (['cents', 'euros'] as const).map((value) => ({
    label: t(`settings.financePage.rounding.${value}`),
    value,
  })),
)
const monthStarts = Array.from({ length: 28 }, (_, index) => ({
  label: `${index + 1}.`,
  value: index + 1,
}))

function set<K extends keyof OwnerSettings>(key: K, value: OwnerSettings[K]): void {
  void update({ [key]: value })
}
</script>

<template>
  <section class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('settings.finance') }}</h1>
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('settings.financePage.taxes') }}</h2>
      </template>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          :label="t('settings.financePage.assessmentLabel')"
          :help="t('settings.financePage.assessmentHelp')"
        >
          <USelect
            :model-value="settings.assessmentDefault"
            :items="assessments"
            class="w-full"
            data-testid="setting-assessment"
            @update:model-value="
              set('assessmentDefault', $event as OwnerSettings['assessmentDefault'])
            "
          />
        </UFormField>
        <UFormField
          :label="t('settings.financePage.churchLabel')"
          :help="t('settings.financePage.churchHelp')"
        >
          <USelect
            :model-value="settings.churchTax"
            :items="churchTaxes"
            class="w-full"
            data-testid="setting-church-tax"
            @update:model-value="set('churchTax', $event as OwnerSettings['churchTax'])"
          />
        </UFormField>
      </div>
    </UCard>
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ t('settings.financePage.budget') }}</h2>
      </template>
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField
          :label="t('settings.financePage.monthStart')"
          :help="t('settings.financePage.monthStartHelp')"
        >
          <USelect
            :model-value="settings.budgetMonthStart"
            :items="monthStarts"
            class="w-full"
            data-testid="setting-month-start"
            @update:model-value="set('budgetMonthStart', Number($event))"
          />
        </UFormField>
        <UFormField :label="t('settings.financePage.roundingLabel')">
          <USelect
            :model-value="settings.rounding"
            :items="roundings"
            class="w-full"
            data-testid="setting-rounding"
            @update:model-value="set('rounding', $event as OwnerSettings['rounding'])"
          />
        </UFormField>
      </div>
      <USwitch
        class="mt-4"
        :model-value="settings.purchasesCountAsSaved"
        :label="t('settings.financePage.purchases')"
        :description="t('settings.financePage.purchasesHelp')"
        data-testid="setting-purchases"
        @update:model-value="set('purchasesCountAsSaved', $event)"
      />
    </UCard>
  </section>
</template>
