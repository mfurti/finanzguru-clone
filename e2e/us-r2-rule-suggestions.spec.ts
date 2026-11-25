import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

/**
 * 006 US2: two identical manual categorizations → "Regel anlegen?"; accept saves the rule,
 * decline hides the pair for good (quickstart W4). Invented recipients only.
 */
const CATEGORY = 'Lebenshaltung › Lebensmittel und Getränke'

async function bookings(request: APIRequestContext, recipient: string, n: number) {
  const accounts = (await (await request.get('/api/accounts')).json()) as {
    id: string
    type: string
  }[]
  const accountId = accounts.find((acc) => acc.type === 'checking')!.id
  const ids: string[] = []
  for (let i = 0; i < n; i++) {
    const res = await request.post('/api/transactions', {
      data: {
        accountId,
        bookingDate: `2026-11-0${i + 1}`,
        amountCents: -999,
        type: 'expense',
        counterparty: recipient,
      },
    })
    ids.push(((await res.json()) as { id: string }).id)
  }
  return ids
}

/** Categorizes row `index` of the filtered table with "Nur diese Buchung". */
async function categorizeRow(page: Page, index: number) {
  await page.getByTestId('category-chip').nth(index).click()
  await page.getByRole('option', { name: CATEGORY }).click()
  await page.getByTestId('category-change-save').click()
}

test.describe('006 US2 rule suggestions', () => {
  test('accept after two corrections; a declined pair never returns', async ({
    page,
    request,
  }, info) => {
    const stamp = `${info.project.name} ${Date.now() % 100000}`
    const accepted = `Vorschlag Ja ${stamp}`
    const declined = `Vorschlag Nein ${stamp}`
    const ids = [
      ...(await bookings(request, accepted, 3)),
      ...(await bookings(request, declined, 3)),
    ]

    await page.goto(`/transactions?q=${encodeURIComponent(accepted)}`)
    await expect(page.getByTestId('category-chip')).toHaveCount(3)
    await categorizeRow(page, 0)
    await categorizeRow(page, 1)
    const banner = page.getByTestId('rule-suggestions')
    const row = banner.getByTestId('rule-suggestion').filter({ hasText: accepted })
    await expect(row).toContainText('1 Buchungen')
    await row.getByTestId('rule-suggestion-accept').click()
    await expect(row).toHaveCount(0)
    await expect(page.getByTestId('category-chip').nth(2)).toContainText('Lebensmittel')

    await page.goto(`/transactions?q=${encodeURIComponent(declined)}`)
    await categorizeRow(page, 0)
    await categorizeRow(page, 1)
    const other = page.getByTestId('rule-suggestion').filter({ hasText: declined })
    await other.getByTestId('rule-suggestion-decline').click()
    await expect(other).toHaveCount(0)
    await page.reload()
    await expect(page.getByTestId('rule-suggestion').filter({ hasText: declined })).toHaveCount(0)

    // Clean up: the accepted rule and the bookings.
    const rules = (await (await request.get('/api/rules')).json()) as {
      id: string
      pattern: string
    }[]
    for (const rule of rules.filter((item) => item.pattern === accepted.toLowerCase())) {
      await request.delete(`/api/rules/${rule.id}`)
    }
    for (const id of ids) await request.delete(`/api/transactions/${id}`)
  })
})
