import { expect, test } from '@playwright/test'

/** Feature 002, US2: Dividenden page (quickstart W6–W7) on the demo dataset. */
test.describe('002 US2 Dividenden', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('W6: summary matches the API and the calendar shows received and expected payments', async ({
    page,
  }) => {
    const summary = await (await page.request.get('/api/dividends/summary')).json()
    const euro = (cents: number) =>
      new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(cents / 100)

    await page.goto('/investments/dividends')
    await expect(page.getByTestId('dividends-last12')).toHaveText(euro(summary.last12Cents))
    await expect(page.getByTestId('dividends-avg')).toHaveText(euro(summary.avgPerMonthCents))
    await expect(page.getByTestId('dividends-by-security')).toContainText('Vanguard FTSE All-World')
    const calendar = page.getByTestId('dividend-calendar')
    await expect(calendar.getByTestId('calendar-expected').first()).toContainText('erwartet')
    await expect(page.locator('body')).not.toContainText('NaN')
  })

  test('W7: adds an expected payment and deletes it again', async ({ page }) => {
    await page.goto('/investments/dividends')
    const before = await page.getByTestId('calendar-expected').count()

    await page.getByTestId('expected-add').click()
    const form = page.getByTestId('expected-form')
    await form.getByTestId('expected-instrument').click()
    await page.getByRole('option', { name: 'Vanguard FTSE All-World UCITS ETF (Dist)' }).click()
    const next = new Date()
    next.setUTCMonth(next.getUTCMonth() + 3, 15)
    await form.getByTestId('expected-pay').fill(next.toISOString().slice(0, 10))
    await form.getByTestId('expected-amount').fill('0,5')
    await form.getByTestId('expected-amount').press('Tab')
    await page.getByTestId('expected-save').click()

    await expect(page.getByTestId('calendar-expected')).toHaveCount(before + 1)
    await page.getByTestId('expected-delete').last().click()
    await expect(page.getByTestId('calendar-expected')).toHaveCount(before)
  })
})
