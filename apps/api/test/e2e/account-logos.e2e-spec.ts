import type { NestFastifyApplication } from '@nestjs/platform-fastify'
import type { AccountDto } from '@finance/shared'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { DB } from '../../src/database/database.constants'
import type { AppDatabase } from '../../src/database/drizzle.module'
import { account, institution } from '../../src/database/schema'
import { loginCookie } from '../helpers/auth'
import { createTestApp } from '../helpers/test-app'

/** Smallest valid PNG (1×1). */
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082',
  'hex',
)

describe('bank and broker logos on accounts (009 T005)', () => {
  let app: NestFastifyApplication
  let cookie: string
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    const dir = mkdtempSync(join(tmpdir(), 'brand-logos-'))
    writeFileSync(
      join(dir, 'brands.json'),
      JSON.stringify([
        { key: 'musterbroker', title: 'Musterbroker', words: ['musterbroker'], file: 'm.png' },
        // Local logo for a brand the built-in sets also know: local wins.
        { key: 'my-klarna', title: 'Klarna lokal', words: ['klarna'], file: 'm.png' },
      ]),
    )
    writeFileSync(join(dir, 'm.png'), PNG)
    app = await createTestApp({}, { BRAND_LOGOS_DIR: dir })
    cookie = await loginCookie(app)
    const db = app.get<AppDatabase>(DB)
    for (const name of [
      'Sparkasse Bodensee Test',
      'Klarna Test',
      'Musterbroker AG',
      'Kleinbank Test',
    ]) {
      const inst = db.insert(institution).values({ name }).returning().get()
      ids[name] = db
        .insert(account)
        .values({ institutionId: inst.id, name: `Konto ${name}`, type: 'checking' })
        .returning()
        .get().id
    }
  })
  afterAll(() => app.close())

  const accounts = async () =>
    (await app
      .inject({ url: '/api/accounts', headers: { cookie } })
      .then((res) => res.json())) as AccountDto[]

  it('adds built-in, local and no logos by institution name', async () => {
    const list = await accounts()
    const by = (name: string) => list.find((acc) => acc.id === ids[name])!
    expect(by('Sparkasse Bodensee Test')).toMatchObject({
      logo: { kind: 'brand', slug: 'thesvg-color:sparkasse' },
      logoSource: 'auto',
      logoKey: expect.stringMatching(/^institution:/),
    })
    expect(by('Klarna Test').logo).toMatchObject({ slug: 'local:my-klarna' })
    expect(by('Musterbroker AG').logo).toMatchObject({
      slug: 'local:musterbroker',
      url: expect.stringMatching(/^\/api\/logos\/brands\/local\/musterbroker\?v=/),
    })
    expect(by('Kleinbank Test')).toMatchObject({ logo: null, logoSource: null })
    const manual = list.filter((acc) => acc.institutionName === 'Manuell')
    for (const acc of manual) expect(acc).toMatchObject({ logo: null, logoKey: null })
  })

  it('stores a choice per institution for all its accounts', async () => {
    const sparkasse = (await accounts()).find((acc) => acc.id === ids['Sparkasse Bodensee Test'])!
    const key = encodeURIComponent(sparkasse.logoKey!)
    await app.inject({
      method: 'PUT',
      url: `/api/logos/recipients/${key}`,
      headers: { cookie },
      payload: { mode: 'none' },
    })
    expect((await accounts()).find((acc) => acc.id === sparkasse.id)!.logo).toBeNull()
    await app.inject({ method: 'DELETE', url: `/api/logos/recipients/${key}`, headers: { cookie } })
    expect((await accounts()).find((acc) => acc.id === sparkasse.id)!.logoSource).toBe('auto')
  })
})
