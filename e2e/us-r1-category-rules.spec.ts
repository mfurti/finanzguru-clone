import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * 006 US1: category change for all bookings of a recipient plus a remembered rule
 * (quickstart W1). Uses an invented recipient so demo data stays untouched.
 */
const CATEGORY = 'Lebenshaltung › Lebensmittel und Getränke'

async function checkingAccount(request: APIRequestContext): Promise<string> {
  const accounts = (await (await request.get('/api/accounts')).json()) as {
    id: string
    type: string
  }[]
  return accounts.find((acc) => acc.type === 'checking')!.id
}

test.describe('006 US1 remember a category', () => {
  test('recipient scope + merken: all bookings change, the rule is listed', async ({
    page,
    request,
  }, info) => {
    const recipient = `Testladen ${info.project.name} ${Date.now() % 100000}`
    const accountId = await checkingAccount(request)
    const ids: string[] = []
    for (const day of ['2026-11-02', '2026-11-03', '2026-11-04']) {
      const res = await request.post('/api/transactions', {
        data: {
          accountId,
          bookingDate: day,
          amountCents: -1234,
          type: 'expense',
          counterparty: recipient,
        },
      })
      expect(res.ok()).toBe(true)
      ids.push(((await res.json()) as { id: string }).id)
    }

    await page.goto(`/transactions?q=${encodeURIComponent(recipient)}`)
    const chips = page.getByTestId('category-chip')
    await expect(chips).toHaveCount(3)
    await chips.first().click()
    await page.getByRole('option', { name: CATEGORY }).click()
    const dialog = page.getByRole('dialog', { name: 'Kategorie ändern' })
    await dialog.getByText('Alle Buchungen dieses Empfängers').click()
    await dialog.getByTestId('category-remember').click()
    await expect(dialog.getByTestId('rule-pattern')).toHaveValue(recipient.toLowerCase())
    await expect(dialog.getByTestId('rule-preview')).toBeVisible()
    await dialog.getByTestId('category-change-save').click()
    await expect(page.getByText('Regel gespeichert', { exact: false })).toBeVisible()
    for (let i = 0; i < 3; i++) {
      await expect(chips.nth(i)).toContainText('Lebensmittel und Getränke')
    }

    await page.goto('/settings/categories')
    await expect(page.getByText(recipient.toLowerCase())).toBeVisible()

    // Clean up: rule and bookings.
    const rules = (await (await request.get('/api/rules')).json()) as {
      id: string
      pattern: string
    }[]
    const rule = rules.find((item) => item.pattern === recipient.toLowerCase())!
    await request.delete(`/api/rules/${rule.id}`)
    for (const id of ids) await request.delete(`/api/transactions/${id}`)
  })
})
