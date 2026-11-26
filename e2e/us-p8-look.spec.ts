import { expect, test } from '@playwright/test'

/** 003 US8: font, tabs and no third-party requests (quickstart W12, SC-007). */
const PAGES = [
  '/',
  '/accounts',
  '/transactions',
  '/investments',
  '/investments/transactions',
  '/investments/analysis',
  '/investments/dividends',
  '/investments/taxes',
  '/budget',
  '/budget/sankey',
  '/budget/budgets',
  '/insurance',
  '/settings/categories',
]

test.describe('003 US8 look', () => {
  test.skip(() => test.info().project.name !== 'desktop', 'runs once')

  test('Outfit everywhere and underlined active main tab', async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => document.fonts.ready)
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily)
    expect(font).toMatch(/^"?Outfit/)
    const active = page.getByTestId('main-tabs').locator('a[aria-current="page"]')
    const style = await active.evaluate((el) => {
      const after = getComputedStyle(el, '::after')
      return {
        bg: getComputedStyle(el).backgroundColor,
        line: after.height,
        lineBg: after.backgroundColor,
      }
    })
    expect(style.bg).toMatch(/rgba\(0, 0, 0, 0\)|transparent/)
    expect(style.line).toBe('2px')
  })

  test('no request leaves the app origin on any page', async ({ page, baseURL }) => {
    const origin = new URL(baseURL!).origin
    const foreign: string[] = []
    page.on('request', (request) => {
      const url = request.url()
      if (url.startsWith('data:') || url.startsWith('blob:')) return
      if (new URL(url).origin !== origin) foreign.push(url)
    })
    for (const path of PAGES) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      await expect(page.locator('body')).not.toContainText('NaN')
    }
    expect(foreign).toEqual([])
  })
})
