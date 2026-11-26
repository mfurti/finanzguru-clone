import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LogoPicker from '~/components/transactions/LogoPicker.vue'

const brands = [
  { slug: 'lidl', title: 'Lidl', hex: '0050AA', url: '/api/logos/brands/lidl.svg?v=1' },
  { slug: 'rewe', title: 'REWE', hex: 'CC071E', url: '/api/logos/brands/rewe.svg?v=1' },
]
/** Every apiFetch call: [url, options]. */
const { calls } = vi.hoisted(() => ({ calls: [] as [string, Record<string, unknown>][] }))
mockNuxtImport('apiFetch', () => async (url: string, options: Record<string, unknown> = {}) => {
  calls.push([url, options])
  if (url === '/api/logos/brands') {
    const q = String((options.query as { q: string }).q).toLowerCase()
    return brands.filter((brand) => brand.title.toLowerCase().includes(q))
  }
  return null
})

let unmount: (() => void) | undefined
async function mount() {
  const wrapper = await mountSuspended(LogoPicker, {
    props: {
      open: true,
      recipientKey: 'lidl dienstleistung',
      name: 'LIDL Dienstleistung',
      logo: null,
      logoSource: null,
    },
    attachTo: document.body,
  })
  unmount = () => wrapper.unmount()
  await flushPromises()
  return wrapper
}
const q = (selector: string) => document.querySelector<HTMLElement>(selector)

describe('LogoPicker (008 T011)', () => {
  afterEach(() => {
    unmount?.()
    document.body.innerHTML = ''
    calls.length = 0
  })

  it('lists brands, explains the scope and searches after typing', async () => {
    vi.useFakeTimers()
    await mount()
    expect(document.body.textContent).toContain('Gilt für alle Buchungen von LIDL Dienstleistung')
    expect(q('[data-testid="logo-option-rewe"]')).not.toBeNull()
    const input = document.querySelector<HTMLInputElement>('input[data-testid="logo-search"]')!
    input.value = 'lid'
    input.dispatchEvent(new Event('input'))
    await vi.advanceTimersByTimeAsync(250)
    await flushPromises()
    expect(q('[data-testid="logo-option-lidl"]')).not.toBeNull()
    expect(q('[data-testid="logo-option-rewe"]')).toBeNull()
    vi.useRealTimers()
  })

  it('saves a brand for the recipient key and emits saved', async () => {
    const wrapper = await mount()
    q('[data-testid="logo-option-lidl"]')!.click()
    await flushPromises()
    expect(calls.at(-1)).toEqual([
      '/api/logos/recipients/lidl%20dienstleistung',
      { method: 'PUT', body: { mode: 'brand', brandSlug: 'lidl' } },
    ])
    expect(wrapper.emitted('saved')).toHaveLength(1)
  })

  it('"Kein Logo" and "Automatisch"', async () => {
    await mount()
    q('[data-testid="logo-none"]')!.click()
    await flushPromises()
    expect(calls.at(-1)![1]).toEqual({ method: 'PUT', body: { mode: 'none' } })
    unmount?.()
    document.body.innerHTML = ''
    await mount()
    q('[data-testid="logo-auto"]')!.click()
    await flushPromises()
    expect(calls.at(-1)![1]).toEqual({ method: 'DELETE' })
  })
})
