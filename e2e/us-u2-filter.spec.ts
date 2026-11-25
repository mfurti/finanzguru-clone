import { expect, test } from '@playwright/test'

/**
 * 007 US2 (quickstart W4): filter side panel, Kontobewegungen "Ausgehende" with
 * 10–100 € shows only matching outgoing bookings; the button counts two filters.
 */
test.describe('007 US2 filter in a side panel', () => {
  test('W4: ausgehend + 10–100 € → only matching rows, badge "2"', async ({
    page,
    request,
  }, info) => {
    const recipient = `Filterladen ${info.project.name} ${Date.now() % 100000}`
    const accounts = (await (await request.get('/api/accounts')).json()) as {
      id: string
      type: string
    }[]
    const accountId = accounts.find((acc) => acc.type === 'checking')!.id
    const ids: string[] = []
    for (const amountCents of [-500, -5000, -8000, 5000, -15000]) {
      const res = await request.post('/api/transactions', {
        data: {
          accountId,
          bookingDate: '2026-11-06',
          amountCents,
          type: amountCents > 0 ? 'income' : 'expense',
          counterparty: recipient,
        },
      })
      expect(res.ok()).toBe(true)
      ids.push(((await res.json()) as { id: string }).id)
    }

    await page.goto(`/transactions?q=${encodeURIComponent(recipient)}`)
    const rows = page.getByTestId('transactions-table').locator('tbody tr')
    await expect(rows).toHaveCount(5)

    await page.getByTestId('filter-button').click()
    const panel = page.getByTestId('filter-panel')
    await panel.getByRole('radio', { name: 'Ausgehende', exact: true }).click()
    await panel.getByTestId('filter-min').fill('10')
    await panel.getByTestId('filter-max').fill('100')
    await page.getByTestId('filter-apply').click()

    await expect(rows).toHaveCount(2)
    await expect(page.getByTestId('filter-count')).toHaveText('2')
    await expect(page).toHaveURL(/direction=out/)
    for (const text of await rows.allTextContents()) expect(text).toMatch(/-(50|80),00/)
    if (info.project.name === 'mobile') {
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(width).toBeLessThanOrEqual(360)
    }

    // Reload keeps the filter (URL), Zurücksetzen clears it.
    await page.reload()
    await expect(rows).toHaveCount(2)
    await page.getByTestId('filter-button').click()
    await expect(page.getByTestId('filter-min')).toHaveValue('10')
    await page.getByTestId('filter-reset').click()
    await expect(rows).toHaveCount(5)

    for (const id of ids) await request.delete(`/api/transactions/${id}`)
  })
})
