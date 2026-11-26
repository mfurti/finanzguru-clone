import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import AccountRow from '~/components/accounts/AccountRow.vue'

const sparkasse = {
  kind: 'brand',
  slug: 'thesvg-color:sparkasse',
  title: 'Sparkasse',
  hex: null,
  url: '/api/logos/brands/thesvg-color/sparkasse.svg?v=1',
}
registerEndpoint('/api/accounts', () => [
  { id: 'a1', institutionName: 'Sparkasse Bodensee', logo: sparkasse },
  { id: 'a2', institutionName: 'Musterbank', logo: null },
  { id: 'a3', institutionName: 'Scalable Capital GmbH', logo: { kind: 'upload', url: '/x.png' } },
])

const row = (id: string, institution: string) => ({
  id,
  name: `Konto ${id}`,
  type: 'checking',
  institution,
  initials: 'KO',
  ibanMasked: null,
  iban: null,
  sparkline: [0, 0],
  lastUpdateAt: null,
  lastUpdateKind: null,
  canSync: false,
  balanceCents: 100,
})

describe('account logos (009 T006)', () => {
  it('shows the bank logo of an account row, initials without logo', async () => {
    const withLogo = await mountSuspended(AccountRow, {
      props: { row: row('a1', 'Sparkasse Bodensee') },
    })
    expect(withLogo.get('[data-testid="merchant-logo"] img').attributes('src')).toBe(sparkasse.url)
    const without = await mountSuspended(AccountRow, { props: { row: row('a2', 'Musterbank') } })
    expect(without.find('[data-testid="merchant-logo"]').exists()).toBe(false)
    expect(without.find('[data-testid="avatar"]').exists()).toBe(true)
  })

  it('finds logos by account id and by part of the institution name', async () => {
    let api: Awaited<ReturnType<typeof useAccountLogos>> | undefined
    await mountSuspended(
      defineComponent({
        async setup() {
          api = await useAccountLogos()
          return () => h('div')
        },
      }),
    )
    expect(api!.byAccount('a1')).toMatchObject({ slug: 'thesvg-color:sparkasse' })
    expect(api!.byAccount('a2')).toBeNull()
    expect(api!.byAccount(null)).toBeNull()
    expect(api!.byInstitution('scalable')).toMatchObject({ kind: 'upload' })
    expect(api!.byInstitution('')).toBeNull()
  })
})
