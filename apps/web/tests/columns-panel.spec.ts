import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import ColumnsPanel, { type ColumnChoice } from '~/components/common/ColumnsPanel.vue'

const columns = [
  { id: 'price', label: 'Aktueller Kurs' },
  { id: 'value', label: 'Aktueller Wert' },
  { id: 'realized', label: 'Realisiert €' },
]

/** Mounts the panel open, with a stub slideover that renders its body and footer inline. */
async function mount(choice: ColumnChoice) {
  const saved = ref<ColumnChoice | null>(null)
  const Host = defineComponent({
    setup: () => () =>
      h(ColumnsPanel, {
        open: true,
        columns,
        choice,
        onSave: (next: ColumnChoice) => (saved.value = next),
      }),
  })
  const wrapper = await mountSuspended(Host, {
    global: {
      stubs: {
        USlideover: defineComponent({
          setup:
            (_, { slots }) =>
            () =>
              h('div', [slots.body?.(), slots.footer?.()]),
        }),
      },
    },
  })
  return { wrapper, saved }
}

describe('ColumnsPanel (012 T005)', () => {
  it('lists the columns in the stored order with their visibility', async () => {
    const { wrapper } = await mount({ order: ['value', 'price'], visible: { realized: false } })
    const rows = wrapper.findAll('[data-column]').map((row) => row.attributes('data-column'))
    expect(rows).toEqual(['value', 'price', 'realized'])
  })

  it('reorders with the move buttons and saves order and visibility', async () => {
    const { wrapper, saved } = await mount({ order: [], visible: { realized: false } })
    const realized = wrapper.get('[data-column="realized"]')
    await realized
      .findAll('button')
      .find((b) => b.attributes('aria-label')?.includes('oben'))!
      .trigger('click')
    await wrapper.get('[data-testid="columns-save"]').trigger('click')
    expect(saved.value).toEqual({
      order: ['price', 'realized', 'value'],
      visible: { price: true, value: true, realized: false },
    })
  })
})
