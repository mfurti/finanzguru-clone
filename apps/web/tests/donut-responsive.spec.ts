import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import DonutChart from '~/components/common/DonutChart.vue'

const items = [
  { key: 'a', value: 6000, color: '#7fdcb5', label: 'A' },
  { key: 'b', value: 4000, color: '#82c3f0', label: 'B' },
]

/** ResizeObserver stub that reports a fixed container width once observed. */
function stubResize(width: number): void {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(private readonly callback: ResizeObserverCallback) {}
      observe() {
        this.callback([{ contentRect: { width } } as ResizeObserverEntry], this as never)
      }
      disconnect() {}
    },
  )
}

describe('responsive donut (012 T013)', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('grows with its container up to maxSize, keeping the ring proportion', async () => {
    stubResize(900)
    const wrapper = await mountSuspended(DonutChart, { props: { items, maxSize: 400 } })
    await nextTick()
    // 400 px diameter + 2 × 8 px halo; ring 22/176 of the diameter = 50 px.
    expect(wrapper.get('[data-testid="donut-chart"]').attributes('width')).toBe('416')
  })

  it('never shrinks below the shared size and stays fixed without maxSize', async () => {
    stubResize(100)
    const small = await mountSuspended(DonutChart, { props: { items, maxSize: 400 } })
    await nextTick()
    expect(small.get('[data-testid="donut-chart"]').attributes('width')).toBe('192')
    const fixed = await mountSuspended(DonutChart, { props: { items } })
    expect(fixed.get('[data-testid="donut-chart"]').attributes('width')).toBe('192')
  })
})
