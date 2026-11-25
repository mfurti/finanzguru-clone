import { describe, expect, it } from 'vitest'
import {
  brandSvg,
  catalogVersion,
  getBrand,
  searchBrands,
} from '../../src/modules/logos/brand-catalog'

describe('brand catalogue (008 T001)', () => {
  it('finds brands by slug with colour and path', () => {
    const lidl = getBrand('lidl')!
    expect(lidl).toMatchObject({ slug: 'lidl', title: 'Lidl', hex: '0050AA' })
    expect(lidl.path.length).toBeGreaterThan(10)
    expect(getBrand('gibtsnicht')).toBeUndefined()
    expect(catalogVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('searches title and extra words, preferred first, with a limit', () => {
    expect(searchBrands('lid', 5).map((b) => b.slug)).toContain('lidl')
    expect(searchBrands('a', 3)).toHaveLength(3)
    const preferred = searchBrands('', 10, new Map(), ['rewe', 'paypal'])
    expect(preferred.map((b) => b.slug)).toEqual(['rewe', 'paypal'])
    const alias = searchBrands('drogerie', 5, new Map([['dm', ['dm drogerie']]]))
    expect(alias.map((b) => b.slug)).toContain('dm')
  })

  it('renders the glyph in brand colour and escapes the title', () => {
    const svg = brandSvg({ slug: 'x', title: 'A & B', hex: '112233', path: 'M0 0h24v24H0z' })
    expect(svg).toContain('fill="#112233"')
    expect(svg).toContain('A &#38; B')
    expect(svg).not.toContain('<script')
  })
})
