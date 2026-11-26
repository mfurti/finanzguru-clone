import { expect, test } from '@playwright/test'
import { login } from './helpers'

// This journey tests the login itself, so it starts without the stored session.
test.use({ storageState: { cookies: [], origins: [] } })

test('redirects to login, rejects a wrong password, then logs in and out', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login\?redirect=/)

  await page.getByLabel('Passwort').fill('falsch')
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByText('Passwort falsch.')).toBeVisible()

  await login(page)
  await expect(page.getByTestId('networth-card')).toBeVisible()

  await page.getByTestId('logout').click()
  await expect(page).toHaveURL(/\/login/)
})
