import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { logoFor, setLocalAliases } from '../../src/domain/logo'
import { getBrand, searchBrands, setLocalBrands } from '../../src/modules/logos/brand-catalog'
import { loadLocalBrands } from '../../src/modules/logos/local-brands'

/** Smallest valid PNG (1×1). */
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d4948445200000001000000010806000000' +
    '1f15c4890000000d49444154789c6360000002000001e221bc330000000049454e44ae426082',
  'hex',
)
const SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 2"><rect width="2" height="2" fill="#0a0"/></svg>'

function folder(entries: unknown, files: Record<string, Buffer | string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'brand-logos-'))
  writeFileSync(
    join(dir, 'brands.json'),
    typeof entries === 'string' ? entries : JSON.stringify(entries),
  )
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body)
  return dir
}

describe('local logo folder (009 T003)', () => {
  afterEach(() => {
    setLocalBrands([], '0')
    setLocalAliases([])
  })

  it('loads valid PNG and SVG entries', () => {
    const warnings: string[] = []
    const dir = folder(
      [
        { key: 'musterbroker', title: 'Musterbroker', words: ['musterbroker'], file: 'm.png' },
        { key: 'beispielbank', title: 'Beispielbank', words: ['beispiel bank'], file: 'b.svg' },
      ],
      { 'm.png': PNG, 'b.svg': SVG },
    )
    const brands = loadLocalBrands(dir, (message) => warnings.push(message))
    expect(brands.map((brand) => [brand.key, brand.contentType])).toEqual([
      ['musterbroker', 'image/png'],
      ['beispielbank', 'image/svg+xml; charset=utf-8'],
    ])
    expect(warnings).toEqual([])
  })

  it('skips invalid entries with one warning each', () => {
    const warnings: string[] = []
    const dir = folder(
      [
        { key: 'big', title: 'Big', words: ['big'], file: 'big.png' },
        { key: 'evil', title: 'Evil', words: ['evil'], file: 'evil.svg' },
        { key: 'text', title: 'Text', words: ['text'], file: 'text.png' },
        { key: 'missing', title: 'Missing', words: ['missing'], file: 'none.png' },
        { key: 'Bad Key', title: 'X', words: ['x'], file: 'm.png' },
        { key: 'traversal', title: 'X', words: ['x'], file: '../m.png' },
        { key: 'ok', title: 'Ok', words: ['ok'], file: 'm.png' },
        { key: 'ok', title: 'Twice', words: ['twice'], file: 'm.png' },
      ],
      {
        'big.png': Buffer.concat([PNG, Buffer.alloc(300 * 1024)]),
        'evil.svg': '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        'text.png': 'hallo',
        'm.png': PNG,
      },
    )
    const brands = loadLocalBrands(dir, (message) => warnings.push(message))
    expect(brands.map((brand) => brand.key)).toEqual(['ok'])
    expect(warnings).toHaveLength(7)
  })

  it('treats a missing folder, missing list or broken JSON as empty', () => {
    const warnings: string[] = []
    expect(loadLocalBrands(join(tmpdir(), 'gibt-es-nicht-009'), (m) => warnings.push(m))).toEqual(
      [],
    )
    const empty = mkdtempSync(join(tmpdir(), 'brand-logos-'))
    mkdirSync(join(empty, 'sub'))
    expect(loadLocalBrands(empty, (m) => warnings.push(m))).toEqual([])
    expect(warnings).toEqual([])
    expect(loadLocalBrands(folder('{kaputt', {}), (m) => warnings.push(m))).toEqual([])
    expect(warnings).toHaveLength(1)
  })

  it('local logos win over built-in ones and come first in search', () => {
    setLocalBrands(
      [{ key: 'my-paypal', title: 'Mein PayPal', body: PNG, contentType: 'image/png' }],
      'v1',
    )
    setLocalAliases([{ key: 'local:my-paypal', words: ['paypal'] }])
    const exists = (key: string) => getBrand(key) !== undefined
    expect(
      logoFor({ type: 'expense', counterparty: 'PayPal (Europe) S.a.r.l.' }, undefined, exists),
    ).toMatchObject({ slug: 'local:my-paypal', source: 'auto' })
    // Longer built-in aliases still win ("aldi sud" before a local "aldi").
    expect(getBrand('local:my-paypal')!.file!.contentType).toBe('image/png')
    expect(searchBrands('paypal', 5)[0]!.key).toBe('local:my-paypal')
  })
})
