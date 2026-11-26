import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MerchantLogo from '~/components/common/MerchantLogo.vue'

describe('MerchantLogo (008 T008)', () => {
  it('shows a brand glyph from this app in a white tile', async () => {
    const wrapper = await mountSuspended(MerchantLogo, {
      props: {
        name: 'REWE Markt GmbH',
        size: 'sm',
        logo: {
          kind: 'brand',
          slug: 'rewe',
          title: 'REWE',
          hex: 'CC071E',
          url: '/api/logos/brands/rewe.svg?v=1',
        },
      },
    })
    const tile = wrapper.get('[data-testid="merchant-logo"]')
    expect(tile.attributes('data-kind')).toBe('brand')
    expect(tile.classes()).toContain('size-7')
    const img = wrapper.get('img')
    expect(img.attributes('src')).toBe('/api/logos/brands/rewe.svg?v=1')
    expect(img.attributes('alt')).toBe('REWE Markt GmbH')
    expect(img.classes()).toContain('object-contain')
  })

  it('shows coloured logos a bit larger than glyphs', async () => {
    const wrapper = await mountSuspended(MerchantLogo, {
      props: {
        name: 'Amazon',
        logo: {
          kind: 'brand',
          slug: 'thesvg-color:amazon',
          title: 'Amazon',
          hex: null,
          url: '/api/logos/brands/thesvg-color/amazon.svg?v=1',
        },
      },
    })
    expect(wrapper.get('img').classes()).toContain('size-[70%]')
  })

  it('fills the tile with an uploaded image', async () => {
    const wrapper = await mountSuspended(MerchantLogo, {
      props: { name: 'Bäckerei', logo: { kind: 'upload', url: '/api/logos/files/x.png' } },
    })
    expect(wrapper.get('img').classes()).toContain('object-cover')
  })

  it('falls back to initials without logo or when the image fails', async () => {
    const plain = await mountSuspended(MerchantLogo, { props: { name: 'Bäckerei Müller' } })
    expect(plain.find('[data-testid="merchant-logo"]').exists()).toBe(false)
    expect(plain.get('[data-testid="avatar"]').text()).toBe('BM')
    const broken = await mountSuspended(MerchantLogo, {
      props: { name: 'Kiosk', logo: { kind: 'upload', url: '/api/logos/files/gone.png' } },
    })
    await broken.get('img').trigger('error')
    expect(broken.find('[data-testid="avatar"]').exists()).toBe(true)
  })
})
