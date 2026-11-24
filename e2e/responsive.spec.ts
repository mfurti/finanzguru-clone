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
  '/transactions?review=unreviewed',
  '/budget/sankey',
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
        test(`${viewport.name}: no horizontal scroll and no NaN on any page`, async ({
          page,
          request,
        }) => {
          await page.setViewportSize({ width: viewport.width, height: viewport.height })
          // Detail pages of 003: one account, one depot, one category.
          const overview = (await (await request.get('/api/accounts/overview')).json()) as {
            groups: { kind: string; rows: { id: string }[] }[]
          }
          const depot = overview.groups.find((g) => g.kind === 'depot')?.rows[0]?.id
          const giro = overview.groups.find((g) => g.kind === 'account')?.rows[0]?.id
          const categories = (await (await request.get('/api/categories')).json()) as {
            id: string
          }[]
          const details = [
            giro && `/accounts/${giro}`,
            depot && `/depots/${depot}`,
            categories[0] && `/budget/categories/${categories[0].id}`,
          ].filter((path): path is string => !!path)
          for (const path of [...PAGES, ...details]) {
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
