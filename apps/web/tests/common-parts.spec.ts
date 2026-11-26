import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import Avatar from '~/components/common/Avatar.vue'
import CategoryIcon from '~/components/common/CategoryIcon.vue'
import CopyButton from '~/components/common/CopyButton.vue'
import SortHeader from '~/components/common/SortHeader.vue'
import Sparkline from '~/components/common/Sparkline.vue'
import { nameHex } from '~/utils/category-colors'

describe('Avatar', () => {
  it('shows up to two initials on a stable color', async () => {
    const two = await mountSuspended(Avatar, { props: { name: 'iShares Core MSCI' } })
    expect(two.text()).toBe('IC')
    expect(two.attributes('style')).toContain(nameHex('iShares Core MSCI').slice(1, 4))
    const one = await mountSuspended(Avatar, { props: { name: 'Girokonto' } })
    expect(one.text()).toBe('GI')
    const empty = await mountSuspended(Avatar, { props: { name: '—' } })
    expect(empty.text()).toBe('?')
  })
})

describe('CopyButton', () => {
  it('writes the value to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const wrapper = await mountSuspended(CopyButton, { props: { value: 'DE89370400440532013000' } })
    await wrapper.find('button').trigger('click')
    expect(writeText).toHaveBeenCalledWith('DE89370400440532013000')
  })
})

describe('Sparkline', () => {
  it('draws a flat line for fewer than two points', async () => {
    const wrapper = await mountSuspended(Sparkline, { props: { values: [500] } })
    const points = wrapper.find('polyline').attributes('points')!.split(' ')
    expect(points).toHaveLength(2)
    expect(points[0]!.split(',')[1]).toBe(points[1]!.split(',')[1])
  })

  it('scales a series into the box without NaN', async () => {
    const wrapper = await mountSuspended(Sparkline, { props: { values: [1, 3, 2, 5] } })
    expect(wrapper.find('polyline').attributes('points')).not.toContain('NaN')
  })
})

describe('SortHeader', () => {
  it('exposes aria-sort and emits toggle', async () => {
    const wrapper = await mountSuspended(SortHeader, { props: { label: 'Datum', dir: 'desc' } })
    expect(wrapper.attributes('aria-sort')).toBe('descending')
    await wrapper.trigger('click')
    expect(wrapper.emitted('toggle')).toHaveLength(1)
  })
})

describe('CategoryIcon', () => {
  it('renders the tile in the given color', async () => {
    const wrapper = await mountSuspended(CategoryIcon, {
      props: { icon: 'i-lucide-house', color: '#8fb0f4' },
    })
    expect(wrapper.attributes('style')).toContain('background-color')
  })
})
