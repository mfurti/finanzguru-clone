import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { formatEur } from '../packages/shared/src/format'

const expected = JSON.parse(
  readFileSync(join(import.meta.dirname, '../apps/api/test/fixtures/demo-expected.json'), 'utf8'),
) as { totalCents: number; unreviewed: number }

test.describe('US1 overview', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('networth-total')).toBeVisible()
  })

  test('shows the demo net worth to the cent and all widgets', async ({ page }) => {
    await expect(page.getByTestId('networth-total')).toHaveText(formatEur(expected.totalCents))
    for (const id of ['allocation-card', 'kpi-card', 'holdings-card', 'accounts-card']) {
      await expect(page.getByTestId(id)).toBeVisible()
    }
    await expect(page.getByTestId('review-banner')).toContainText(String(expected.unreviewed))
    await expect(page.locator('body')).not.toContainText('NaN')
  })

  test('switches periods and the return view', async ({ page }) => {
    const card = page.getByTestId('networth-card')
    await card.getByRole('tab', { name: '1W' }).click()
    await expect(card.getByRole('tab', { name: '1W' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByTestId('networth-total')).toHaveText(formatEur(expected.totalCents))
    await card.getByRole('tab', { name: 'Rendite' }).click()
    await expect(card.getByRole('tab', { name: 'Rendite' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  test('restricts all widgets to the selected account', async ({ page }) => {
    await page.getByTestId('account-filter').click()
    await page.getByRole('checkbox', { name: 'Demo Girokonto' }).click()
    await expect(page).toHaveURL(/accounts=/)
    await expect(page.getByTestId('networth-total')).toHaveText('4.377,37 €')
    await expect(page.getByTestId('account-filter')).toContainText('Demo Girokonto')
  })

  test('hides a widget via Anpassen and shows it again', async ({ page }) => {
    await expect(page.getByTestId('budgets-card')).toBeVisible()
    await page.getByTestId('customize-open').click()
    await page.getByTestId('customize-list').getByText('Budgets').click()
    await page.getByTestId('customize-save').click()
    await expect(page.getByTestId('budgets-card')).toHaveCount(0)

    await page.getByTestId('customize-open').click()
    await page.getByTestId('customize-list').getByText('Budgets').click()
    await page.getByTestId('customize-save').click()
    await expect(page.getByTestId('budgets-card')).toBeVisible()
  })

  test('has no horizontal page scroll', async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
