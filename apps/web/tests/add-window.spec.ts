import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AccountFormModal from '~/components/common/AccountFormModal.vue'
import AddWindow from '~/components/common/AddWindow.vue'

registerEndpoint('/api/accounts', () => [])
const { navigated } = vi.hoisted(() => ({ navigated: [] as unknown[] }))
mockNuxtImport('navigateTo', () => (target: unknown) => {
  navigated.push(target)
})

let unmount: (() => void) | undefined
async function openWindow() {
  const wrapper = await mountSuspended(AddWindow, { attachTo: document.body })
  unmount = () => wrapper.unmount()
  document.querySelector<HTMLElement>('[data-testid="add-menu"]')!.click()
  await flushPromises()
  return wrapper
}
const q = (selector: string) => document.querySelector<HTMLElement>(selector)
async function type(value: string): Promise<void> {
  const input = document.querySelector<HTMLInputElement>('input[data-testid="add-search"]')!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('AddWindow (007 T016)', () => {
  afterEach(() => {
    unmount?.()
    document.body.innerHTML = ''
    navigated.length = 0
  })

  it('opens "Was möchtest du hinzufügen?" with providers and assets tabs', async () => {
    await openWindow()
    const text = document.body.textContent ?? ''
    expect(text).toContain('Was möchtest du hinzufügen?')
    expect(text).toContain('Anbieter')
    expect(text).toContain('Assets')
    expect(text).toContain('Beliebte Anbieter')
    expect(q('[data-testid="add-provider-sparkasse"]')).not.toBeNull()
  })

  it('searches by name and by IBAN', async () => {
    await openWindow()
    await type('scal')
    expect(q('[data-testid="add-provider-scalable"]')).not.toBeNull()
    expect(q('[data-testid="add-provider-sparkasse"]')).toBeNull()
    await type('DE12 3456 7890 1234 5678 90')
    expect(q('[data-testid="add-provider-bank"]')).not.toBeNull()
    await type('gibtsnicht')
    expect(document.body.textContent).toContain('Für diesen Anbieter nicht verfügbar')
  })

  it('asks "Wie möchtest du importieren?" and opens the chosen flow', async () => {
    await openWindow()
    q('[data-testid="add-provider-sparkasse"]')!.click()
    await flushPromises()
    const text = document.body.textContent ?? ''
    expect(text).toContain('Wie möchtest du importieren?')
    expect(text).toContain('Automatisch')
    expect(text).toContain('Datei hochladen')
    expect(text).toContain('Manuell')
    q('[data-testid="add-method-file"]')!.click()
    await flushPromises()
    expect(navigated).toEqual(['/settings/sources#csv'])
  })
})

describe('AccountFormModal', () => {
  it('mounts closed without errors', async () => {
    const wrapper = await mountSuspended(AccountFormModal, { props: { open: false } })
    expect(wrapper.html()).not.toContain('NaN')
  })
})
