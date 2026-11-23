import { expect, test } from '@playwright/test'

/** Every page of the app (SC-006: no horizontal scroll down to 360 px). */
const PAGES = [
  '/',
  '/accounts',
  '/transactions',
  '/investments',
  '/investments/transactions',
  '/investments/analysis',
  '/investments/dividends',
  '/investments/taxes',
  '/investments/watchlists',
  '/budget',
  '/budget/review',
  '/budget/budgets',
  '/insurance',
  '/settings/sources',
  '/settings/categories',
  '/settings/inflation',
]

const VIEWPORTS = [
  { name: 'phone', width: 360, height: 780 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
]

// Viewports are set explicitly here, so one project is enough.
test.describe('responsive layout and themes', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'covers all viewports itself')

  for (const scheme of ['dark', 'light'] as const) {
    test.describe(`${scheme} mode`, () => {
      test.use({ colorScheme: scheme })

      for (const viewport of VIEWPORTS) {
        test(`${viewport.name}: no horizontal scroll and no NaN on any page`, async ({ page }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height })
          for (const path of PAGES) {
            await page.goto(path)
            await page.waitForLoadState('networkidle')
            const overflow = await page.evaluate(
              () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
            )
            expect(overflow, `${path} overflows by ${overflow}px`).toBeLessThanOrEqual(0)
            await expect(page.locator('body'), path).not.toContainText('NaN')
            const dark = await page.evaluate(() =>
              document.documentElement.classList.contains('dark'),
            )
            expect(dark, `${path} color mode`).toBe(scheme === 'dark')
          }
        })
      }
    })
  }
})
