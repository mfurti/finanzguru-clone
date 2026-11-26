import { expect, test } from '@playwright/test'

/**
 * 005 US4: "Asset suchen" on a watchlist (quickstart W5). The test API has no Scalable
 * connection, so search and chart are mocked; adding goes through the real API.
 */
const results = {
  available: true,
  groups: [
    {
      assetClass: 'stock',
      hits: [{ isin: 'US0378331005', wkn: null, name: 'Apple', assetClass: 'stock' }],
      more: false,
    },
    {
      assetClass: 'etf',
      hits: [
        {
          isin: 'IE00BK5BZS07',
          wkn: null,
          name: 'Leverage Shares 3x Apple ETP',
          assetClass: 'etf',
        },
      ],
      more: false,
    },
  ],
}

test.describe('005 US4 watchlist search', () => {
  test('search, filter by class, add; adding twice is refused', async ({ page }, info) => {
    const res = await page.request.post('/api/watchlists', {
      data: { name: `Suche ${info.project.name} ${Date.now() % 100000}` },
    })
    const { id } = (await res.json()) as { id: string }
    let lastClass: string | null = null
    await page.route('**/api/market-data/search**', (route) => {
      lastClass = new URL(route.request().url()).searchParams.get('class')
      const groups = lastClass
        ? results.groups.filter((group) => group.assetClass === lastClass)
        : results.groups
      return route.fulfill({ json: { available: true, groups } })
    })
    await page.route('**/api/market-data/chart/**', (route) => route.fulfill({ json: [] }))

    await page.goto(`/investments/watchlists/${id}`)
    await page.getByTestId('asset-search-open').click()
    await page.getByTestId('asset-search-input').fill('Apple')
    await expect(page.getByTestId('asset-search-group-stock')).toContainText('US0378331005')
    await expect(page.getByTestId('asset-search-group-etf')).toBeVisible()

    await page.getByTestId('asset-search-chip-stock').click()
    await expect(page.getByTestId('asset-search-group-etf')).toHaveCount(0)
    expect(lastClass).toBe('stock')

    await page.getByTestId('asset-search-add-US0378331005').click()
    await expect(page.getByText('Zur Watchlist hinzugefügt', { exact: true })).toBeVisible()
    await page.getByTestId('asset-search-add-US0378331005').click()
    await expect(page.getByText('Schon auf der Watchlist', { exact: true })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('watchlist-entries')).toContainText('Apple')
    await expect(page.locator('body')).not.toContainText('NaN')
    await page.request.delete(`/api/watchlists/${id}`)
  })

  test('without Scalable the dialog explains why and links to Datenquellen', async ({ page }) => {
    const res = await page.request.post('/api/watchlists', {
      data: { name: `Ohne ${Date.now() % 100000}` },
    })
    const { id } = (await res.json()) as { id: string }
    await page.route('**/api/market-data/search**', (route) =>
      route.fulfill({ json: { available: false, groups: [] } }),
    )
    await page.goto(`/investments/watchlists/${id}`)
    await page.getByTestId('asset-search-open').click()
    await page.getByTestId('asset-search-input').fill('Apple')
    await expect(page.getByTestId('asset-search-unavailable')).toContainText('Scalable')
    await page.request.delete(`/api/watchlists/${id}`)
  })
})
