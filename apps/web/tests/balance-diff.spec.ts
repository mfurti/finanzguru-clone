import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AccountRow from '~/components/accounts/AccountRow.vue'

registerEndpoint('/api/accounts', () => [{ id: 'a1', institutionName: 'Testbank', logo: null }])

const row = (balanceCheck: unknown) => ({
  id: 'a1',
  name: 'Giro',
  type: 'checking',
  institution: 'Testbank',
  initials: 'TB',
  ibanMasked: null,
  iban: null,
  sparkline: [0, 0],
  lastUpdateAt: null,
  lastUpdateKind: null,
  canSync: true,
  balanceCents: 97_500,
  balanceCheck,
})
// UTooltip needs UApp's TooltipProvider, which a single-component mount lacks.
const stubs = { UTooltip: { template: '<span><slot /></span>' } }

describe('balance difference warning (013 T005)', () => {
  it('warns only when the balance differs from the source', async () => {
    const differs = await mountSuspended(AccountRow, {
      props: {
        row: row({ sourceCents: 95_000, at: '2026-11-27T10:00:00Z', differenceCents: -2_500 }),
      },
      global: { stubs },
    })
    expect(differs.find('[data-testid="balance-diff"]').exists()).toBe(true)

    const fine = await mountSuspended(AccountRow, {
      props: { row: row({ sourceCents: 97_500, at: '2026-11-27T10:00:00Z', differenceCents: 0 }) },
      global: { stubs },
    })
    expect(fine.find('[data-testid="balance-diff"]').exists()).toBe(false)
    const unknown = await mountSuspended(AccountRow, {
      props: { row: row(null) },
      global: { stubs },
    })
    expect(unknown.find('[data-testid="balance-diff"]').exists()).toBe(false)
  })
})
