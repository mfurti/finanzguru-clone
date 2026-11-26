import { expect, test } from '@playwright/test'

/** Feature 002, US4: Steuern page (quickstart W10–W11) on the demo dataset. */
test.describe('002 US4 Steuern', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('W10: a second order above the allowance shows the warning', async ({ page }) => {
    await page.goto('/investments/taxes')
    const orders = page.getByTestId('exemption-orders')
    await expect(orders.getByTestId('order-list')).toContainText('Demo Broker')
    await expect(orders.getByTestId('allowance-warning')).toBeHidden()

    await orders.getByTestId('order-add').click()
    const form = page.getByTestId('order-form')
    await expect(form.getByTestId('order-broker')).toContainText('Demo Bank')
    await form.getByTestId('order-amount').fill('300')
    await form.getByTestId('order-amount').press('Tab')
    await page.getByTestId('order-save').click()

    await expect(orders.getByTestId('allowance-warning')).toContainText(
      'Sparerpauschbetrag überschritten',
    )
    await expect(orders.getByTestId('order-list')).toContainText('Demo Bank')

    // Clean up: remove the added order again.
    await orders
      .getByRole('listitem')
      .filter({ hasText: 'Demo Bank' })
      .getByTestId('order-delete')
      .click()
    await expect(orders.getByTestId('allowance-warning')).toBeHidden()
  })

  test('W11: the Vorabpauschale is shown as an estimate per fund', async ({ page }) => {
    await page.goto('/investments/taxes')
    await page.getByRole('button', { name: String(new Date().getFullYear() - 1) }).click()
    const vorab = page.getByTestId('vorabpauschale')
    await expect(vorab).toContainText('Schätzung')
    await expect(vorab.getByTestId('base-rate-missing')).toBeHidden()
    await expect(vorab.locator('tbody tr.row-hover')).toHaveCount(3)
    await expect(vorab.getByTestId('vorab-total')).toContainText('€')
    await expect(page.locator('body')).not.toContainText('NaN')
  })
})
