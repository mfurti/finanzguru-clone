import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TransactionListItem } from '@finance/shared'
import BookingPanel from '~/components/transactions/BookingPanel.vue'

/** Every apiFetch call of the panel: [url, options]. */
const { calls } = vi.hoisted(() => ({ calls: [] as [string, Record<string, unknown>][] }))
mockNuxtImport('apiFetch', () => async (url: string, options: Record<string, unknown> = {}) => {
  calls.push([url, options])
  return {}
})

const item: TransactionListItem = {
  id: 't1',
  accountId: 'a1',
  accountName: 'Giro …1234',
  institutionName: 'Musterbank',
  bookingDate: '2026-11-03',
  amountCents: -4233,
  type: 'expense',
  counterparty: 'Laden am Markt',
  counterpartyIban: 'DE00123456780000000000',
  purpose: 'KARTENZAHLUNG · Einkauf',
  note: null,
  categoryId: 'c1',
  categoryName: 'Lebensmittel',
  categoryIcon: 'tag',
  categoryColor: 'neutral',
  categorySource: 'manual',
  reviewStatus: 'reviewed',
  tags: [],
}

let unmount: (() => void) | undefined
async function mount(over: Partial<TransactionListItem> = {}) {
  const wrapper = await mountSuspended(BookingPanel, {
    props: { item: { ...item, ...over }, tags: [], open: true },
    attachTo: document.body,
  })
  unmount = () => wrapper.unmount()
  await flushPromises()
  return wrapper
}
const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)

describe('BookingPanel (007 T006)', () => {
  afterEach(() => {
    unmount?.()
    document.body.innerHTML = ''
    calls.length = 0
  })

  it('shows header, account and details', async () => {
    await mount()
    const text = document.body.textContent ?? ''
    expect(text).toContain('Laden am Markt')
    expect(text).toContain('Giro …1234')
    expect(text).toContain('Musterbank')
    expect(text).toContain('DE00123456780000000000')
    expect(text).toContain('KARTENZAHLUNG · Einkauf')
    expect(text).toContain('Lebensmittel')
    expect(text).not.toContain('NaN')
  })

  it('saves the note on blur, trimmed, and only when changed', async () => {
    await mount()
    const area = q<HTMLTextAreaElement>('textarea[data-testid="panel-note"]')!
    area.dispatchEvent(new Event('blur'))
    await flushPromises()
    expect(calls).toHaveLength(0)
    area.value = '  Geschenk für Anna  '
    area.dispatchEvent(new Event('input'))
    area.dispatchEvent(new Event('blur'))
    await flushPromises()
    expect(calls[0]).toEqual([
      '/api/transactions/t1',
      { method: 'PATCH', body: { note: 'Geschenk für Anna' } },
    ])
  })

  it('switches mark unreviewed and transfer', async () => {
    const wrapper = await mount()
    q<HTMLElement>(
      '[data-testid="panel-unreviewed"] button, button[data-testid="panel-unreviewed"]',
    )!.click()
    await flushPromises()
    expect(calls.at(-1)![1]).toEqual({ method: 'PATCH', body: { reviewStatus: 'unreviewed' } })
    q<HTMLElement>(
      '[data-testid="panel-transfer"] button, button[data-testid="panel-transfer"]',
    )!.click()
    await flushPromises()
    expect(calls.at(-1)![1]).toEqual({ method: 'PATCH', body: { type: 'transfer' } })
    expect(wrapper.emitted('changed')).toHaveLength(2)
  })

  it('turning transfer off restores the type by sign', async () => {
    await mount({ type: 'transfer', amountCents: 5000 })
    q<HTMLElement>(
      '[data-testid="panel-transfer"] button, button[data-testid="panel-transfer"]',
    )!.click()
    await flushPromises()
    expect(calls.at(-1)![1]).toEqual({ method: 'PATCH', body: { type: 'income' } })
  })

  it('asks the table for the category window and for delete', async () => {
    const wrapper = await mount()
    q<HTMLElement>('[data-testid="panel-category"]')!.click()
    q<HTMLElement>('[data-testid="panel-delete"]')!.click()
    await flushPromises()
    expect(wrapper.emitted('category')).toHaveLength(1)
    expect(wrapper.emitted('delete')).toHaveLength(1)
  })
})
