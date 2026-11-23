import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import ColumnMapper from '~/components/import/ColumnMapper.vue'
import ImportResult from '~/components/import/ImportResult.vue'

describe('ImportResult', () => {
  it('shows counts and translated row errors with line numbers', async () => {
    const wrapper = await mountSuspended(ImportResult, {
      props: {
        job: {
          id: 'j',
          sourceId: 'csv',
          kind: 'csv_upload',
          fileName: 'a.csv',
          format: 'sparkasse-camt-v8',
          accountId: null,
          status: 'partial',
          imported: 2,
          skipped: 0,
          failed: 2,
          errors: [
            { line: 3, reason: 'invalid_date' },
            { line: 4, reason: 'invalid_amount' },
          ],
          startedAt: '',
          finishedAt: null,
        },
      },
    })
    expect(wrapper.text()).toContain('Import mit Fehlern abgeschlossen')
    expect(wrapper.get('[data-testid="import-imported"]').text()).toBe('2')
    expect(wrapper.get('[data-testid="import-errors"]').text()).toContain('Zeile 3')
    expect(wrapper.get('[data-testid="import-errors"]').text()).toContain('Ungültiges Datum')
  })
})

describe('ColumnMapper', () => {
  it('guesses date, amount and counterparty columns from header names', async () => {
    const wrapper = await mountSuspended(ColumnMapper, {
      props: {
        headers: ['Datum', 'Betrag', 'Empfaenger', 'Zweck'],
        preview: [['2026-11-01', '1500.00', 'Arbeitgeber', 'Gehalt']],
        delimiter: ',',
        encoding: 'utf-8',
        modelValue: {
          delimiter: ',',
          encoding: 'utf-8',
          dateFormat: 'DD.MM.YYYY',
          decimalSeparator: ',',
          skipRows: 0,
          columns: {} as never,
        },
      },
    })
    const updates = wrapper.emitted('update:modelValue') ?? []
    const last = updates.at(-1)?.[0] as {
      columns: Record<string, number>
      dateFormat: string
      decimalSeparator: string
    }
    expect(last.columns).toMatchObject({ date: 0, amount: 1, counterparty: 2, purpose: 3 })
    // Detected from the preview row: ISO dates, dot decimals.
    expect(last.dateFormat).toBe('YYYY-MM-DD')
    expect(last.decimalSeparator).toBe('.')
    expect(wrapper.text()).toContain('Arbeitgeber')
  })
})
