import { expect, type Page } from '@playwright/test'
import { E2E_PASSWORD } from './constants'

/** Logs in through the UI and waits for the app shell. */
export async function login(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Passwort').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByTestId('account-filter')).toBeVisible()
}
