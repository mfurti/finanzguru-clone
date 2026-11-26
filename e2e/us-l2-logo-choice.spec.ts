import { expect, test, type APIRequestContext } from '@playwright/test'

/**
 * 008 US2 (quickstart L3, L4): choose a brand in the side panel for a recipient without
 * automatic match; it applies to all its bookings, survives reload and covers new bookings;
 * "Kein Logo" and "Automatisch" work.
 */
async function booking(request: APIRequestContext, counterparty: string): Promise<string> {
  const accounts = (await (await request.get('/api/accounts')).json()) as {
    id: string
    type: string
  }[]
  const res = await request.post('/api/transactions', {
    data: {
      accountId: accounts.find((acc) => acc.type === 'checking')!.id,
      bookingDate: '2026-11-08',
      amountCents: -899,
      type: 'expense',
      counterparty,
    },
  })
  expect(res.ok()).toBe(true)
  return ((await res.json()) as { id: string }).id
}

test.describe('008 US2 logo choice', () => {
  test('L3 + L4: choose Lidl, reload, new booking, Kein Logo, Automatisch', async ({
    page,
    request,
  }, info) => {
    const name = `Discounter Dienstleistung ${info.project.name} ${Date.now() % 100000}`
    const ids = [await booking(request, name), await booking(request, name)]
    await page.goto(`/transactions?q=${encodeURIComponent(name)}`)
    const rows = page.getByTestId('transactions-table').locator('tbody tr')
    await expect(rows).toHaveCount(2)
    await expect(rows.getByTestId('merchant-logo')).toHaveCount(0)

    await rows.first().locator('td').nth(1).click()
    await page.getByTestId('panel-logo').click()
    const picker = page.getByRole('dialog', { name: 'Logo wählen' })
    await picker.getByTestId('logo-search').fill('lid')
    await picker.getByTestId('logo-option-thesvg-color:lidl').click()
    await expect(picker).toHaveCount(0)
    await expect(rows.getByTestId('merchant-logo')).toHaveCount(2)

    await page.reload()
    ids.push(await booking(request, name))
    await page.reload()
    await expect(rows).toHaveCount(3)
    await expect(rows.getByTestId('merchant-logo').locator('img[src*="lidl.svg"]')).toHaveCount(3)

    await rows.first().locator('td').nth(1).click()
    await page.getByTestId('panel-logo').click()
    await page.getByRole('dialog', { name: 'Logo wählen' }).getByTestId('logo-none').click()
    await expect(rows.getByTestId('merchant-logo')).toHaveCount(0)

    await page.getByTestId('panel-logo').click()
    await page.getByRole('dialog', { name: 'Logo wählen' }).getByTestId('logo-auto').click()
    // No automatic match for this invented name: initials again.
    await expect(rows.getByTestId('avatar')).toHaveCount(3)

    for (const id of ids) await request.delete(`/api/transactions/${id}`)
  })
})
