import { describe, expect, it } from 'vitest'
import {
  catalogVersions,
  getBrand,
  glyphSvg,
  isSafeSvgBody,
  searchBrands,
} from '../../src/modules/logos/brand-catalog'

describe('brand catalogue (008 T001, T018)', () => {
  it('has Simple Icons glyphs by key and by legacy slug', () => {
    const lidl = getBrand('simple-icons:lidl')!
    expect(lidl).toMatchObject({ set: 'simple-icons', name: 'lidl', title: 'Lidl', hex: '0050AA' })
    expect(lidl.svg).toContain('fill="#0050AA"')
    expect(getBrand('lidl')).toBe(lidl)
    expect(getBrand('gibtsnicht')).toBeUndefined()
    expect(getBrand('other-set:lidl')).toBeUndefined()
    expect(catalogVersions['simple-icons']).toMatch(/^\d+\.\d+\.\d+$/)
    expect(catalogVersions['thesvg-color']).toBe('1.2.25')
  })

  it('has coloured theSVG logos with their own viewBox and a readable title', () => {
    const amazon = getBrand('thesvg-color:amazon')!
    expect(amazon).toMatchObject({ set: 'thesvg-color', hex: null, title: 'Amazon' })
    expect(amazon.svg).toMatch(
      /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 \d+ \d+"/,
    )
    expect(getBrand('thesvg-color:deutsche-bahn')!.title).toBe('Deutsche Bahn')
    expect(getBrand('thesvg-color:rewe')!.title).toBe('REWE')
    // White variants for dark backgrounds would be invisible on the white tile.
    expect(getBrand('thesvg-color:apple-dark')).toBeUndefined()
    expect(getBrand('thesvg-color:apple-light')).toBeDefined()
  })

  it('refuses SVG bodies that could run scripts or load other documents', () => {
    expect(isSafeSvgBody('<path fill="#f90" d="M0 0h1"/>')).toBe(true)
    expect(isSafeSvgBody('<use href="#a"/>')).toBe(true)
    for (const body of [
      '<script>alert(1)</script>',
      '<path onload="alert(1)"/>',
      '<a href="javascript:alert(1)"/>',
      '<image href="https://example.com/x.png"/>',
      '<use xlink:href="other.svg#a"/>',
      '<foreignObject></foreignObject>',
    ]) {
      expect(isSafeSvgBody(body), body).toBe(false)
    }
  })

  it('searches both sets, lists a brand once (coloured first), preferred first', () => {
    const lid = searchBrands('lidl', 10)
    expect(lid.filter((b) => b.title === 'Lidl').map((b) => b.key)).toEqual(['thesvg-color:lidl'])
    expect(searchBrands('a', 3)).toHaveLength(3)
    const preferred = searchBrands('', 10, new Map(), ['simple-icons:rewe', 'thesvg-color:paypal'])
    expect(preferred.map((b) => b.key)).toEqual(['simple-icons:rewe', 'thesvg-color:paypal'])
    const alias = searchBrands('drogerie', 5, new Map([['thesvg-color:dm', ['dm drogerie']]]))
    expect(alias.map((b) => b.key)).toContain('thesvg-color:dm')
  })

  it('renders glyphs in brand colour and escapes the title', () => {
    const svg = glyphSvg('A & B', '112233', 'M0 0h24v24H0z')
    expect(svg).toContain('fill="#112233"')
    expect(svg).toContain('A &#38; B')
  })
})
