import { expect, test } from '@playwright/test'

/**
 * 009 US1 (quickstart A1): bank logos on the overview card, Konten, account detail and in the
 * account filter; "Manuell" keeps initials; nothing is loaded from other hosts.
 */
test.describe('009 US1 bank and broker logos', () => {
  test('A1: Sparkasse logo everywhere, Manuell initials', async ({ page, request }, info) => {
    const stamp = `${info.project.name} ${Date.now() % 100000}`
    const create = async (name: string, institutionName?: string) => {
      const res = await request.post('/api/accounts', {
        data: { name, type: 'checking', ...(institutionName ? { institutionName } : {}) },
      })
      expect(res.ok()).toBe(true)
      return ((await res.json()) as { id: string }).id
    }
    const bankId = await create(`Giro ${stamp}`, `Sparkasse Logotest ${stamp}`)
    const manualId = await create(`Bargeld ${stamp}`)

    const hosts = new Set<string>()
    page.on('request', (req) => hosts.add(new URL(req.url()).host))

    await page.goto('/accounts')
    const bankRow = page.getByTestId('account-row').filter({ hasText: `Giro ${stamp}` })
    await expect(bankRow.getByTestId('merchant-logo').locator('img')).toHaveAttribute(
      'src',
      /sparkasse\.svg/,
    )
    const manualRow = page.getByTestId('account-row').filter({ hasText: `Bargeld ${stamp}` })
    await expect(manualRow.getByTestId('merchant-logo')).toHaveCount(0)
    await expect(manualRow.getByTestId('avatar')).toBeVisible()

    await page.goto(`/accounts/${bankId}`)
    await expect(page.getByTestId('account-logo').locator('img')).toHaveAttribute(
      'src',
      /sparkasse\.svg/,
    )

    await page.goto('/')
    await expect(
      page
        .getByTestId('accounts-card')
        .getByTestId('merchant-logo')
        .locator('img[src*="sparkasse"]')
        .first(),
    ).toBeVisible()
    await page.getByTestId('account-filter').click()
    await expect(page.locator('img[src*="sparkasse.svg"]').first()).toBeVisible()

    expect([...hosts].every((host) => host === new URL(page.url()).host)).toBe(true)
    if (info.project.name === 'mobile') {
      const width = await page.evaluate(() => document.documentElement.scrollWidth)
      expect(width).toBeLessThanOrEqual(360)
    }
    for (const id of [bankId, manualId]) await request.delete(`/api/accounts/${id}`)
  })
})
