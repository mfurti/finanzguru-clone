import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CategoryNode, TransactionListItem } from '@finance/shared'
import CategoryWindow from '~/components/transactions/CategoryWindow.vue'

const node = (
  id: string,
  name: string,
  isDefault = true,
  children: CategoryNode[] = [],
): CategoryNode => ({
  id,
  parentId: null,
  name,
  kind: 'expense',
  color: 'neutral',
  icon: 'tag',
  isDefault,
  children,
})
const tree: CategoryNode[] = [
  node('m1', 'Wohnen', true, [node('c1', 'Strom'), node('c2', 'Miete')]),
  node('m2', 'Lebenshaltung', true, [node('c3', 'Lebensmittel'), node('c4', 'Hobby', false)]),
]
registerEndpoint('/api/categories', () => tree)

/** Every apiFetch call of the window: [url, options]. */
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
    categoryId: 'c1',
    bookingDate: '2026-11-01',
    amountCents: -1000,
  }) as unknown as TransactionListItem

let unmount: (() => void) | undefined
async function mount(items: TransactionListItem[]) {
  const wrapper = await mountSuspended(CategoryWindow, {
    props: { items, open: true },
    attachTo: document.body,
  })
  unmount = () => wrapper.unmount()
  await flushPromises()
  return wrapper
}
const q = <T extends Element = HTMLElement>(selector: string) => document.querySelector<T>(selector)
async function click(selector: string): Promise<void> {
  q<HTMLElement>(selector)!.click()
  await flushPromises()
}
async function type(selector: string, value: string): Promise<void> {
  const input = q<HTMLInputElement>(selector)!
  input.value = value
  input.dispatchEvent(new Event('input'))
  await flushPromises()
}

describe('CategoryWindow (007 T005)', () => {
  afterEach(() => {
    unmount?.()
    document.body.innerHTML = ''
    calls.length = 0
  })

  it('opens the group of the current category and marks it', async () => {
    await mount([item('t1', 'Stadtwerke')])
    expect(q('[data-testid="category-option-c1"]')!.getAttribute('aria-selected')).toBe('true')
    expect(q('[data-testid="category-option-c3"]')).toBeNull()
    await click('[data-testid="category-group-m2"]')
    expect(q('[data-testid="category-option-c3"]')).not.toBeNull()
  })

  it('filters by search', async () => {
    await mount([item('t1', 'Stadtwerke')])
    await type('input[data-testid="category-search"]', 'lebens')
    expect(q('[data-testid="category-option-c3"]')).not.toBeNull()
    expect(q('[data-testid="category-group-m1"]')).toBeNull()
    await type('input[data-testid="category-search"]', 'zzz')
    expect(document.body.textContent).toContain('Keine passende Kategorie')
  })

  it('saves the chosen category with scope and a pre-filled rule', async () => {
    await mount([item('t1', 'Stadtwerke Musterstadt')])
    await click('[data-testid="category-group-m2"]')
    await click('[data-testid="category-option-c3"]')
    expect(document.body.textContent).toContain('Alle Buchungen dieses Empfängers')
    await click('[data-testid="category-remember"]')
    expect(q<HTMLInputElement>('input[data-testid="rule-pattern"]')!.value).toBe(
      'stadtwerke musterstadt',
    )
    await click('[data-testid="category-change-save"]')
    const patch = calls.find(([url]) => url === '/api/transactions/t1')!
    expect(patch[1]).toMatchObject({
      method: 'PATCH',
      body: {
        categoryId: 'c3',
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
    expect(q<HTMLButtonElement>('[data-testid="category-change-save"]')!.disabled).toBe(true)
    await click('[data-testid="category-group-m1"]')
    await click('[data-testid="category-option-c2"]')
    expect(document.body.textContent).toContain('unterschiedliche Empfänger')
    await click('[data-testid="category-change-save"]')
    const bulk = calls.find(([url]) => url === '/api/transactions/bulk')!
    expect(bulk[1]).toMatchObject({
      method: 'POST',
      body: { ids: ['t1', 't2'], action: 'setCategory', value: 'c2' },
    })
    expect((bulk[1].body as Record<string, unknown>).createRule).toBeUndefined()
  })

  it('shows the inline form for a new category', async () => {
    await mount([item('t1', 'Stadtwerke')])
    await click('[data-testid="category-create"]')
    expect(q('[data-testid="category-create-form"]')).not.toBeNull()
    await type('input[data-testid="category-create-name"]', 'Neu')
    // Without a main category the form cannot be sent.
    const submit = q<HTMLButtonElement>(
      '[data-testid="category-create-form"] button[type="submit"]',
    )
    expect(submit!.disabled).toBe(true)
  })
})
