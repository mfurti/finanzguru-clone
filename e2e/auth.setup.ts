import { test as setup } from '@playwright/test'
import { login } from './helpers'

export const STORAGE_STATE = 'e2e/.auth/owner.json'

setup('log in once and store the session', async ({ page }) => {
  await login(page)
  await page.context().storageState({ path: STORAGE_STATE })
})
