import { expect, test } from '@playwright/test'
import { openSettingsGroup } from './helpers'

/** 014 US1: rename, archive and restore an account in Einstellungen › Konten. */
test.describe('014 US1 account settings', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'changes shared data, runs once')

  test('rename, archive and restore an account', async ({ page }) => {
    await page.goto('/')
    await openSettingsGroup(page, 'accounts', 'Konten')
    const row = (name: string) =>
      page.locator(`[data-testid="account-setting"][data-name="${name}"]`)

    const name = row('Demo Girokonto').getByTestId('account-name')
    await name.fill('Giro umbenannt')
    await name.press('Enter')
    await expect(row('Giro umbenannt')).toHaveCount(1)
    await page.reload()
    await expect(row('Giro umbenannt')).toHaveCount(1)

    // Archive: leaves the list and the account filter, comes back on restore.
    await row('Giro umbenannt').getByTestId('account-archive').click()
    await expect(page.getByTestId('archived-accounts')).toContainText('Giro umbenannt')
    await expect(row('Giro umbenannt')).toHaveCount(0)
    await page.getByTestId('account-filter').click()
    await expect(page.getByRole('checkbox', { name: 'Demo Depot' })).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Giro umbenannt' })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.getByTestId('account-restore').click()
    await expect(page.getByTestId('archived-accounts')).toHaveCount(0)
    const back = row('Giro umbenannt').getByTestId('account-name')
    await back.fill('Demo Girokonto')
    await back.press('Enter')
    await expect(row('Demo Girokonto')).toHaveCount(1)
  })
})
