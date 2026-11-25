import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TransactionListItem } from '@finance/shared'
import CategoryChangeDialog from '~/components/transactions/CategoryChangeDialog.vue'

/** Every apiFetch call of the dialog: [url, options]. */
const { calls } = vi.hoisted(() => ({ calls: [] as [string, Record<string, unknown>][] }))
mockNuxtImport('apiFetch', () => async (url: string, options: Record<string, unknown> = {}) => {
  calls.push([url, options])
  if (url === '/api/rules/preview') return { matches: 2, wouldChange: 2 }
  return { updated: 3, ruleId: null, ruleApplied: 0, suggestion: null, affected: 2 }
})

const item = (id: string, counterparty: string | null, purpose: string | null = null) =>
  ({
    id,
    counterparty,
    counterpartyIban: null,
    purpose,
    bookingDate: '2026-11-01',
    amountCents: -1000,
  }) as unknown as TransactionListItem

let unmount: (() => void) | undefined
async function mount(items: TransactionListItem[]) {
  const wrapper = await mountSuspended(CategoryChangeDialog, {
    props: { items, categoryId: 'c1', categoryName: 'Strom', open: true },
    attachTo: document.body,
  })
  unmount = () => wrapper.unmount()
  await flushPromises()
  return wrapper
}
const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)

describe('CategoryChangeDialog (006 T008)', () => {
  afterEach(() => {
    unmount?.()
    document.body.innerHTML = ''
    calls.length = 0
  })

  it('offers both scopes and sends a pre-filled rule when remembering', async () => {
    await mount([item('t1', 'Stadtwerke Musterstadt')])
    expect(document.body.textContent).toContain('Alle Buchungen dieses Empfängers')
    q<HTMLElement>('[data-testid="category-remember"]')!.click()
    await flushPromises()
    expect(q<HTMLInputElement>('input[data-testid="rule-pattern"]')!.value).toBe(
      'stadtwerke musterstadt',
    )
    q<HTMLElement>('[data-testid="category-change-save"]')!.click()
    await flushPromises()
    const patch = calls.find(([url]) => url === '/api/transactions/t1')!
    expect(patch[1]).toMatchObject({
      method: 'PATCH',
      body: {
        categoryId: 'c1',
        scope: 'single',
        createRule: {
          matchField: 'counterparty',
          operator: 'contains',
          pattern: 'stadtwerke musterstadt',
        },
      },
    })
  })

  it('hides the recipient scope without counterparty', async () => {
    await mount([item('t1', null, 'KARTENZAHLUNG · Kiosk am Markt')])
    expect(document.body.textContent).not.toContain('Alle Buchungen dieses Empfängers')
    expect(document.body.textContent).toContain('Für ähnliche Buchungen merken')
  })

  it('sends bulk without a rule and explains why for different recipients', async () => {
    await mount([item('t1', 'Laden A'), item('t2', 'Laden B')])
    expect(document.body.textContent).toContain('unterschiedliche Empfänger')
    q<HTMLElement>('[data-testid="category-change-save"]')!.click()
    await flushPromises()
    const bulk = calls.find(([url]) => url === '/api/transactions/bulk')!
    expect(bulk[1]).toMatchObject({
      method: 'POST',
      body: { ids: ['t1', 't2'], action: 'setCategory', value: 'c1' },
    })
    expect((bulk[1].body as Record<string, unknown>).createRule).toBeUndefined()
  })
})
