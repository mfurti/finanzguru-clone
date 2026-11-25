import { describe, expect, it } from 'vitest'
import { BRAND_ALIASES } from '../../src/domain/brands'
import { logoFor, matchBrand, recipientKey, type LogoTx } from '../../src/domain/logo'
import { getBrand } from '../../src/modules/logos/brand-catalog'

const exists = (slug: string) => getBrand(slug) !== undefined
const expense = (counterparty: string | null, purpose: string | null = null): LogoTx => ({
  type: 'expense',
  counterparty,
  purpose,
})

describe('merchant logo matching (008 T005)', () => {
  it.each([
    ['REWE Markt GmbH', 'rewe'],
    ['PayPal (Europe) S.a.r.l. et Cie, S.C.A.', 'paypal'],
    ['ALDI SÜD Dienstleistungs-SE', 'aldisud'],
    ['Aldi GmbH & Co. KG', 'aldinord'],
    ['dm-drogerie markt GmbH', 'dm'],
    ["McDonald's Deutschland", 'mcdonalds'],
    ['DB Vertrieb GmbH', 'deutschebahn'],
    ['Telekom Deutschland GmbH', 'deutschetelekom'],
  ])('%s → %s', (name, slug) => {
    expect(matchBrand(name)).toBe(slug)
  })

  it.each([
    'Admiral Spielhalle',
    'Ottobrunn Apotheke',
    'Bäckerei Müller',
    'Reweland',
    'AMZN Mktp DE',
    '',
  ])('no false match for "%s"', (name) => {
    expect(matchBrand(name)).toBeNull()
  })

  it('every curated slug exists in the catalogue', () => {
    expect(BRAND_ALIASES.filter((brand) => !exists(brand.slug))).toEqual([])
  })

  it('uses the purpose part only without counterparty', () => {
    expect(logoFor(expense(null, 'KARTENZAHLUNG · LIDL SAGT DANKE'), undefined, exists)).toEqual({
      kind: 'brand',
      slug: 'lidl',
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
    expect(logoFor(tx, { mode: 'brand', brandSlug: 'lidl', fileName: null }, exists)).toEqual({
      kind: 'brand',
      slug: 'lidl',
      source: 'manual',
    })
    expect(logoFor(tx, { mode: 'none', brandSlug: null, fileName: null }, exists)).toBeNull()
    // A chosen brand that left the catalogue falls back to the automatic match.
    expect(logoFor(tx, { mode: 'brand', brandSlug: 'gone', fileName: null }, exists)).toEqual({
      kind: 'brand',
      slug: 'rewe',
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
