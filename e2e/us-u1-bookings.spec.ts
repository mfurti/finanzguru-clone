import { expect, test, type APIRequestContext, type Page } from '@playwright/test'
import { chooseCategory } from './helpers'

/**
 * 007 US1 (quickstart W1–W3): Betrag always visible, booking side panel with note and
 * transfer switch, large category window. Uses an invented recipient so demo data stays.
 */
async function booking(request: APIRequestContext, recipient: string): Promise<string> {
  const accounts = (await (await request.get('/api/accounts')).json()) as {
    id: string
    type: string
  }[]
  const res = await request.post('/api/transactions', {
    data: {
      accountId: accounts.find((acc) => acc.type === 'checking')!.id,
      bookingDate: '2026-11-05',
      amountCents: -2599,
      type: 'expense',
      counterparty: recipient,
      purpose: 'KARTENZAHLUNG · Ein sehr langer Verwendungszweck für die Breitenprüfung',
    },
  })
  expect(res.ok()).toBe(true)
  return ((await res.json()) as { id: string }).id
}

/** Table not wider than its box and the amount cell inside the viewport. */
async function expectAmountVisible(page: Page): Promise<void> {
  const table = page.getByTestId('transactions-table')
  const sizes = await table.evaluate((box) => ({
    box: box.clientWidth,
    table: box.querySelector('table')!.scrollWidth,
  }))
  expect(sizes.table).toBeLessThanOrEqual(sizes.box + 1)
  const amount = table.locator('tbody tr').first().locator('td').last()
  await expect(amount).toBeInViewport()
  await expect(amount).toContainText('€')
}

test.describe('007 US1 bookings like the reference', () => {
  test('W1: Betrag visible at 1024, 1280 and 1440 px', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'widths are set here')
    await page.goto('/transactions')
    for (const width of [1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 800 })
      await expectAmountVisible(page)
    }
  })

  test('W2 + W3: side panel, note, transfer and category window', async ({
    page,
    request,
  }, info) => {
    const recipient = `Panelladen ${info.project.name} ${Date.now() % 100000}`
    const id = await booking(request, recipient)
    await page.goto(`/transactions?q=${encodeURIComponent(recipient)}`)
    if (info.project.name === 'mobile') {
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(width).toBeLessThanOrEqual(360)
    }

    // Row click opens the panel; the checkbox and the chip do not.
    const row = page.getByTestId('transactions-table').locator('tbody tr').first()
    await row.getByTestId('select-row').click()
    await expect(page.getByTestId('booking-panel')).toHaveCount(0)
    await row.getByTestId('select-row').click()
    await row.locator('td').nth(1).click()
    const panel = page.getByTestId('booking-panel')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText(recipient)
    await expect(panel).toContainText('-25,99')
    await expect(panel.getByTestId('panel-purpose')).toContainText('Breitenprüfung')

    await panel.getByTestId('panel-note').fill('Geschenk')
    await panel.getByTestId('panel-note').blur()
    await expect
      .poll(async () => {
        const list = (await (
          await request.get(`/api/transactions?q=${encodeURIComponent(recipient)}`)
        ).json()) as { items: { note: string | null }[] }
        return list.items[0]?.note
      })
      .toBe('Geschenk')

    await panel.getByTestId('panel-transfer').click()
    await expect(panel.getByTestId('panel-type')).toContainText('Umbuchung')
    await panel.getByTestId('panel-transfer').click()
    await expect(panel.getByTestId('panel-type')).toContainText('Ausgabe')

    // Category from the panel: search, choose, merken, Speichern.
    await panel.getByTestId('panel-category').click()
    const dialog = await chooseCategory(page, 'Lebenshaltung › Lebensmittel und Getränke')
    await dialog.getByTestId('category-remember').click()
    await expect(dialog.getByTestId('rule-pattern')).toHaveValue(recipient.toLowerCase())
    await dialog.getByTestId('category-change-save').click()
    await expect(dialog).toHaveCount(0)
    await expect(panel.getByTestId('panel-category')).toContainText('Lebensmittel und Getränke')

    // Clean up: rule and booking.
    const rules = (await (await request.get('/api/rules')).json()) as {
      id: string
      pattern: string
    }[]
    const rule = rules.find((item) => item.pattern === recipient.toLowerCase())
    if (rule) await request.delete(`/api/rules/${rule.id}`)
    await request.delete(`/api/transactions/${id}`)
  })
})
