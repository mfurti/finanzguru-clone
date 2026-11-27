import { expect, test } from '@playwright/test'
import { openSettingsGroup } from './helpers'

/** 014 US4: sessions and automatic logout in Einstellungen › Sicherheit. */
test.describe('014 US4 security settings', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'changes shared settings, runs once')
  test.afterEach(async ({ request }) => {
    await request.patch('/api/settings', { data: { autoLogoutMinutes: 0 } })
  })

  test('shows this device and stores the automatic logout', async ({ page }) => {
    await page.goto('/')
    await openSettingsGroup(page, 'security', 'Sicherheit')
    await expect(page.getByTestId('sessions')).toContainText('Dieses Gerät')

    await page.getByTestId('setting-auto-logout').click()
    await page.getByRole('option', { name: 'Nach 15 Minuten' }).click()
    await page.reload()
    await expect(page.getByTestId('setting-auto-logout')).toHaveText(/Nach 15 Minuten/)
  })
})

test.describe('014 US4 about', () => {
  test('shows version and database size', async ({ page }) => {
    await page.goto('/')
    await openSettingsGroup(page, 'about', 'Über die App')
    await expect(page.getByTestId('about-version')).toHaveText(/\d+\.\d+\.\d+/)
    await expect(page.getByTestId('about-size')).toHaveText(/\d.*(KB|MB)/)
  })
})
