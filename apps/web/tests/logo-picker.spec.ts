import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import LogoPicker from '~/components/transactions/LogoPicker.vue'

const brands = [
  { slug: 'lidl', title: 'Lidl', hex: '0050AA', url: '/api/logos/brands/lidl.svg?v=1' },
  { slug: 'rewe', title: 'REWE', hex: 'CC071E', url: '/api/logos/brands/rewe.svg?v=1' },
]
/** Toast titles: single-component mounts have no toaster to render them. */
const { toasts } = vi.hoisted(() => ({ toasts: [] as string[] }))
mockNuxtImport('useToast', () => () => ({
  add: (toast: { title: string }) => toasts.push(toast.title),
}))

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
    toasts.length = 0
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

  it('uploads PNG, JPEG or WebP up to 256 KB and refuses others before sending', async () => {
    await mount()
    const input = document.querySelector<HTMLInputElement>('input[data-testid="logo-file"]')!
    const choose = async (file: File) => {
      Object.defineProperty(input, 'files', { value: [file], configurable: true })
      input.dispatchEvent(new Event('change'))
      await flushPromises()
    }
    await choose(new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' }))
    await choose(new File([new Uint8Array(300 * 1024)], 'big.png', { type: 'image/png' }))
    expect(calls.some(([url]) => url.endsWith('/upload'))).toBe(false)
    expect(toasts).toEqual(['Nur PNG, JPEG oder WebP', 'Bild zu groß (max. 256 KB)'])
    await choose(new File([new Uint8Array(100)], 'ok.png', { type: 'image/png' }))
    const [url, options] = calls.at(-1)!
    expect(url).toBe('/api/logos/recipients/lidl%20dienstleistung/upload')
    expect(options.method).toBe('POST')
    expect((options.body as FormData).get('file')).toBeInstanceOf(File)
  })

  it('shows the institution note instead of the booking note (009)', async () => {
    const wrapper = await mountSuspended(LogoPicker, {
      props: {
        open: true,
        recipientKey: 'institution:i1',
        name: 'Sparkasse Bodensee',
        logo: null,
        logoSource: null,
        note: 'Gilt für alle Konten von Sparkasse Bodensee',
      },
      attachTo: document.body,
    })
    unmount = () => wrapper.unmount()
    await flushPromises()
    expect(document.body.textContent).toContain('Gilt für alle Konten von Sparkasse Bodensee')
    expect(document.body.textContent).not.toContain('Gilt für alle Buchungen')
    q('[data-testid="logo-none"]')!.click()
    await flushPromises()
    expect(calls.at(-1)![0]).toBe('/api/logos/recipients/institution%3Ai1')
  })
})
