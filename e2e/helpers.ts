import { expect, type Locator, type Page } from '@playwright/test'
import { E2E_PASSWORD } from './constants'

/** Logs in through the UI and waits for the app shell. */
export async function login(page: Page, path = '/'): Promise<void> {
  await page.goto(path)
  await expect(page).toHaveURL(/\/login/)
  await page.getByLabel('Passwort').fill(E2E_PASSWORD)
  await page.getByRole('button', { name: 'Anmelden' }).click()
  await expect(page.getByTestId('account-filter')).toBeVisible()
}

/**
 * Picks a category in the category window (007 US1): searches the sub-category of
 * "Main › Sub" and clicks it. Returns the window for scope, "merken" and Speichern.
 */
export async function chooseCategory(page: Page, label: string): Promise<Locator> {
  const dialog = page.getByRole('dialog', { name: 'Kategorie ändern' })
  const name = label.split(' › ').at(-1)!
  await dialog.getByTestId('category-search').fill(name)
  await dialog.getByRole('option', { name, exact: true }).click()
  return dialog
}
