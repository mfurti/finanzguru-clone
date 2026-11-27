import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ArtBadge from '~/components/investments/ArtBadge.vue'

describe('ArtBadge (012 T006)', () => {
  it.each([
    ['buy', 'Kauf', 'success'],
    ['sell', 'Verkauf', 'info'],
    ['dividend', 'Dividende', 'neutral'],
  ])('%s → %s in %s', async (type, label, color) => {
    const wrapper = await mountSuspended(ArtBadge, { props: { type } })
    const badge = wrapper.get('[data-testid="art-badge"]')
    expect(badge.text()).toBe(label)
    expect(badge.classes().join(' ')).toContain(
      color === 'neutral' ? 'text-default' : `text-${color}`,
    )
  })
})
