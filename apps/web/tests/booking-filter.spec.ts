import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import BookingFilterPanel from '~/components/transactions/BookingFilterPanel.vue'
import type { BookingQueryState } from '~/composables/useBookingQuery'

registerEndpoint('/api/categories', () => [])
registerEndpoint('/api/accounts', () => [
  { id: 'a1', name: 'Giro', isHidden: false },
  { id: 'a2', name: 'Alt', isHidden: true },
])

const base: BookingQueryState = {
  q: '',
  review: 'all',
  types: [],
  categoryIds: [],
  tagIds: [],
  direction: 'all',
  from: '',
  to: '',
  minCents: null,
  maxCents: null,
  sort: 'date',
  dir: 'desc',
  page: 1,
  pageSize: 50,
}

let unmount: (() => void) | undefined
async function mount(state: Partial<BookingQueryState> = {}, active = 0) {
  const wrapper = await mountSuspended(BookingFilterPanel, {
    props: { state: { ...base, ...state }, active, tags: [], showAccounts: true },
    attachTo: document.body,
  })
  unmount = () => wrapper.unmount()
  q<HTMLElement>('[data-testid="filter-button"]')!.click()
  await flushPromises()
  return wrapper
}
const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)
const input = (id: string) => q<HTMLInputElement>(`input[data-testid="${id}"]`)!
async function type(id: string, value: string): Promise<void> {
  input(id).value = value
  input(id).dispatchEvent(new Event('input'))
  await flushPromises()
}
async function chooseDirection(index: number): Promise<void> {
  document.querySelectorAll<HTMLElement>('[data-testid="filter-direction"] button')[index]!.click()
  await flushPromises()
}

describe('BookingFilterPanel (007 T009)', () => {
  afterEach(() => {
    unmount?.()
    document.body.innerHTML = ''
  })

  it('shows the reference sections in a side panel', async () => {
    await mount({}, 2)
    const text = document.body.textContent ?? ''
    for (const label of [
      'Konten',
      'Art der Transaktion',
      'Zeitraum',
      'Kategorie',
      'Kontobewegungen',
      'Ein- und ausgehende',
      'Min Betrag',
      'Max Betrag',
      'Ergebnisse anzeigen',
    ]) {
      expect(text).toContain(label)
    }
    expect(q('[data-testid="filter-count"]')!.textContent).toBe('2')
  })

  it('outgoing with 10–100 € becomes the signed range −100 € to −10 €', async () => {
    const wrapper = await mount()
    await chooseDirection(2)
    await type('filter-min', '10')
    await type('filter-max', '100')
    q<HTMLElement>('[data-testid="filter-apply"]')!.click()
    await flushPromises()
    const [patch, accounts] = wrapper.emitted('apply')![0] as [Partial<BookingQueryState>, string[]]
    expect(patch).toMatchObject({ direction: 'out', minCents: -10000, maxCents: -1000 })
    expect(accounts).toEqual([])
  })

  it('incoming keeps the amounts positive; reopening shows unsigned values', async () => {
    const wrapper = await mount()
    await chooseDirection(1)
    await type('filter-min', '-5')
    q<HTMLElement>('[data-testid="filter-apply"]')!.click()
    await flushPromises()
    expect(wrapper.emitted('apply')![0]![0]).toMatchObject({ direction: 'in', minCents: 500 })
    unmount?.()
    document.body.innerHTML = ''
    await mount({ direction: 'out', minCents: -10000, maxCents: -1000 })
    expect(input('filter-min').value).toBe('10')
    expect(input('filter-max').value).toBe('100')
  })

  it('Zurücksetzen clears everything including the accounts', async () => {
    const wrapper = await mount({ direction: 'out', review: 'unreviewed' })
    q<HTMLElement>('[data-testid="filter-reset"]')!.click()
    await flushPromises()
    const [patch, accounts] = wrapper.emitted('apply')![0] as [Partial<BookingQueryState>, string[]]
    expect(patch).toMatchObject({ direction: 'all', review: 'all', minCents: null })
    expect(accounts).toEqual([])
  })
})
