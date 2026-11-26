import { describe, expect, it } from 'vitest'
import { BRAND_ALIASES } from '../../src/domain/brands'
import { logoFor, matchBrand, recipientKey, type LogoTx } from '../../src/domain/logo'
import { getBrand } from '../../src/modules/logos/brand-catalog'

const exists = (key: string) => getBrand(key) !== undefined
const expense = (counterparty: string | null, purpose: string | null = null): LogoTx => ({
  type: 'expense',
  counterparty,
  purpose,
})

describe('merchant logo matching (008 T005, T019)', () => {
  it.each([
    ['REWE Markt GmbH', 'thesvg-color:rewe'],
    ['PayPal (Europe) S.a.r.l. et Cie, S.C.A.', 'thesvg-color:paypal'],
    ['ALDI SÜD Dienstleistungs-SE', 'thesvg-color:aldi-sud'],
    ['Aldi GmbH & Co. KG', 'thesvg-color:aldi-nord'],
    ['dm-drogerie markt GmbH', 'thesvg-color:dm'],
    ["McDonald's Deutschland", 'thesvg-color:mcdonalds'],
    ['DB Vertrieb GmbH', 'thesvg-color:deutsche-bahn'],
    ['Telekom Deutschland GmbH', 'thesvg-color:deutsche-telekom'],
    ['AMZN Mktp DE', 'thesvg-color:amazon'],
    ['Amazon Payments Europe S.C.A.', 'thesvg-color:amazon'],
    ['Uber BV', 'thesvg-color:uber-light'],
    ['Deutsche Post AG', 'thesvg-color:deutsche-post'],
    ['MediaMarkt Heilbronn', 'thesvg-color:mediamarkt'],
  ])('%s → %s', (name, key) => {
    expect(logoFor(expense(name), undefined, exists)).toMatchObject({ slug: key, source: 'auto' })
  })

  it.each(['Admiral Spielhalle', 'Ottobrunn Apotheke', 'Bäckerei Müller', 'Reweland', ''])(
    'no false match for "%s"',
    (name) => {
      expect(matchBrand(name)).toBeNull()
    },
  )

  it('every curated key exists in the catalogue, colour first', () => {
    expect(BRAND_ALIASES.flatMap((brand) => brand.keys).filter((key) => !exists(key))).toEqual([])
    expect(BRAND_ALIASES.every((brand) => brand.keys[0]!.startsWith('thesvg-color:'))).toBe(true)
  })

  it('falls back to the glyph when the coloured key is missing', () => {
    const onlyGlyphs = (key: string) => key.startsWith('simple-icons:') && exists(key)
    expect(logoFor(expense('REWE Markt GmbH'), undefined, onlyGlyphs)).toMatchObject({
      slug: 'simple-icons:rewe',
    })
    expect(logoFor(expense('Amazon EU'), undefined, onlyGlyphs)).toBeNull()
  })

  it('uses the purpose part only without counterparty', () => {
    expect(logoFor(expense(null, 'KARTENZAHLUNG · LIDL SAGT DANKE'), undefined, exists)).toEqual({
      kind: 'brand',
      slug: 'thesvg-color:lidl',
      source: 'auto',
    })
    expect(logoFor(expense('Bäckerei', 'KARTENZAHLUNG · LIDL'), undefined, exists)).toBeNull()
  })

  it('applies upload, manual brand, none, auto in this order', () => {
    const tx = expense('REWE Markt GmbH')
    expect(logoFor(tx, { mode: 'upload', brandSlug: null, fileName: 'f.png' }, exists)).toEqual({
      kind: 'upload',
      fileName: 'f.png',
      source: 'manual',
    })
    // Stored before 008 R8: a Simple Icons slug without set still works.
    expect(logoFor(tx, { mode: 'brand', brandSlug: 'lidl', fileName: null }, exists)).toEqual({
      kind: 'brand',
      slug: 'lidl',
      source: 'manual',
    })
    expect(
      logoFor(tx, { mode: 'brand', brandSlug: 'thesvg-color:lidl', fileName: null }, exists),
    ).toMatchObject({ slug: 'thesvg-color:lidl', source: 'manual' })
    expect(logoFor(tx, { mode: 'none', brandSlug: null, fileName: null }, exists)).toBeNull()
    // A chosen brand that left the catalogue falls back to the automatic match.
    expect(logoFor(tx, { mode: 'brand', brandSlug: 'gone', fileName: null }, exists)).toEqual({
      kind: 'brand',
      slug: 'thesvg-color:rewe',
      source: 'auto',
    })
  })

  it('gives transfers and trades no logo', () => {
    expect(logoFor({ type: 'transfer', counterparty: 'PayPal' }, undefined, exists)).toBeNull()
    expect(logoFor({ type: 'buy', counterparty: 'Apple' }, undefined, exists)).toBeNull()
  })

  it('builds the recipient key like the 006 rule draft', () => {
    expect(recipientKey({ counterparty: '  REWE  Markt ' })).toBe('rewe markt')
    expect(recipientKey({ counterparty: null, counterpartyIban: 'de12 3456' })).toBe(
      'iban:DE123456',
    )
    expect(recipientKey({ counterparty: null, purpose: 'KARTENZAHLUNG · Kiosk am Markt' })).toBe(
      'purpose:kiosk am markt',
    )
    expect(recipientKey({ counterparty: null, purpose: null })).toBeNull()
  })
})
