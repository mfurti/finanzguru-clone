import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import type { RuleDraft } from '@finance/shared'
import RuleFields from '~/components/transactions/RuleFields.vue'

registerEndpoint('/api/rules/preview', {
  method: 'POST',
  handler: () => ({ matches: 5, wouldChange: 3 }),
})

/** Wraps RuleFields with a v-model so the test sees the edited draft. */
function host(initial: RuleDraft) {
  const draft = ref<RuleDraft>(initial)
  const Host = defineComponent({
    setup: () => () =>
      h(RuleFields, {
        modelValue: draft.value,
        'onUpdate:modelValue': (value: RuleDraft) => (draft.value = value),
      }),
  })
  return { Host, draft }
}

describe('RuleFields (006 T007)', () => {
  beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }))
  afterEach(() => vi.useRealTimers())

  it('shows how many bookings the rule would change', async () => {
    const { Host } = host({
      matchField: 'counterparty',
      operator: 'contains',
      pattern: 'stadtwerke',
    })
    const wrapper = await mountSuspended(Host)
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(wrapper.get('[data-testid="rule-preview"]').text()).toContain(
      '3 Buchungen würden geändert',
    )
    expect(wrapper.text()).toContain('5 Buchungen passen')
  })

  it('edits the pattern through v-model', async () => {
    const { Host, draft } = host({ matchField: 'counterparty', operator: 'contains', pattern: 'a' })
    const wrapper = await mountSuspended(Host)
    await wrapper.get('input[data-testid="rule-pattern"]').setValue('miete')
    expect(draft.value.pattern).toBe('miete')
  })
})
