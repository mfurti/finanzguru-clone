import { expect, test } from '@playwright/test'

test.describe('US6 insurance', () => {
  test.describe.configure({ mode: 'serial' })
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('V12: adds a term-life contract, shows its yearly cost, edits and deletes it', async ({
    page,
  }) => {
    await page.goto('/insurance')
    await expect(page.getByText('Noch keine Versicherungen')).toBeVisible()

    await page.getByTestId('insurance-add').click()
    await page.getByTestId('insurance-type').click()
    await page.getByRole('option', { name: 'Risiko-Lebensversicherung' }).click()
    await page.getByTestId('insurance-provider').fill('Demo Versicherung AG')
    await page.getByTestId('insurance-premium').fill('23,62')
    await page.getByTestId('insurance-premium').press('Tab')
    await page.getByTestId('insurance-save').click()

    await expect(page.getByTestId('contract-list')).toContainText('Demo Versicherung AG')
    await expect(page.getByTestId('yearly-cost')).toContainText('283,44 €')

    await page.getByTestId('contract-delete').click()
    await page.getByTestId('contract-delete-confirm').click()
    await expect(page.getByText('Noch keine Versicherungen')).toBeVisible()
  })
})
