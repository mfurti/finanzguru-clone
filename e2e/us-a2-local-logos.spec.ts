import { expect, test } from '@playwright/test'

/**
 * 009 US2 (quickstart A2): a logo from the local folder (here an invented brand from
 * `e2e/fixtures/local-logos`) shows for the institution's accounts and for bookings.
 */
test.describe('009 US2 local logo folder', () => {
  test('A2: local logo on account and booking', async ({ page, request }, info) => {
    const stamp = `${info.project.name} ${Date.now() % 100000}`
    const res = await request.post('/api/accounts', {
      data: { name: `Depot ${stamp}`, type: 'checking', institutionName: 'Musterbroker AG' },
    })
    expect(res.ok()).toBe(true)
    const accountId = ((await res.json()) as { id: string }).id
    const booking = await request.post('/api/transactions', {
      data: {
        accountId,
        bookingDate: '2026-11-21',
        amountCents: -5000,
        type: 'expense',
        counterparty: `Musterbroker Capital ${stamp}`,
      },
    })
    expect(booking.ok()).toBe(true)

    await page.goto('/accounts')
    const row = page.getByTestId('account-row').filter({ hasText: `Depot ${stamp}` })
    const img = row.getByTestId('merchant-logo').locator('img')
    await expect(img).toHaveAttribute('src', /\/api\/logos\/brands\/local\/musterbroker\?v=/)
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBe(64)

    await page.goto(`/transactions?q=${encodeURIComponent(`Musterbroker Capital ${stamp}`)}`)
    await expect(
      page.getByTestId('transactions-table').getByTestId('merchant-logo').locator('img'),
    ).toHaveAttribute('src', /local\/musterbroker/)

    await request.delete(`/api/accounts/${accountId}`)
  })
})
