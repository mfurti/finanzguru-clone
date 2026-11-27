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

/**
 * Opens a settings group client-side (014): header gear, then the group in the settings
 * navigation (sidebar from 1024 px, dropdown below). Client-side, so mocked API routes apply.
 */
export async function openSettingsGroup(page: Page, key: string, label: string): Promise<void> {
  await page.locator('a[href="/settings"]').first().click()
  await expect(page).toHaveURL(/\/settings\//)
  // The sidebar shows from 1024 px (SectionNav `lg`), the dropdown below.
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await page.getByTestId(`section-nav-${key}`).click()
  } else {
    await page.getByTestId('section-nav-menu').click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
  }
  await expect(page).toHaveURL(new RegExp(`/settings/${key}`))
}
