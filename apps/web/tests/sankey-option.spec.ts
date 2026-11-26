import { describe, expect, it } from 'vitest'
import { buildSankeyOption, sankeyNodeTotals } from '~/utils/sankey-option'

const nodes = [
  { id: 'income', label: 'Einnahmen', kind: 'income' as const },
  { id: 'main:leben', label: 'Lebenshaltung', kind: 'main' as const },
  { id: 'main:wohnen', label: 'Wohnen', kind: 'main' as const },
  { id: 'balance', label: 'Gespart', kind: 'balance' as const },
  { id: 'sub:essen', label: 'Lebensmittel', kind: 'sub' as const },
  { id: 'sub:miete', label: 'Miete', kind: 'sub' as const },
  { id: 'sub:strom', label: 'Strom <Stadtwerke>', kind: 'sub' as const },
  { id: 'main:leer', label: 'Leer', kind: 'main' as const },
]
const links = [
  { source: 'income', target: 'main:leben', value: 40000 },
  { source: 'income', target: 'main:wohnen', value: 90000 },
  { source: 'income', target: 'balance', value: 20000 },
  { source: 'main:leben', target: 'sub:essen', value: 40000 },
  { source: 'main:wohnen', target: 'sub:miete', value: 89900 },
  { source: 'main:wohnen', target: 'sub:strom', value: 100 },
  { source: 'income', target: 'main:leer', value: 0 },
]
const theme = {
  text: '#eee',
  muted: '#999',
  tooltipBackground: '#111',
  tooltipBorder: '#333',
  background: '#222',
}
const base = {
  nodes,
  links,
  incomeCents: 150000,
  unit: 'eur' as const,
  colorOf: (id: string) => `color-${id}`,
  theme,
  height: 420,
}
const series = (option: ReturnType<typeof buildSankeyOption>) => option.series[0]!
const node = (option: ReturnType<typeof buildSankeyOption>, id: string) =>
  series(option).data.find((item) => item.name === id)!

describe('buildSankeyOption (011 T002)', () => {
  it('keeps the crossing-free order in fixed columns without relaxation', () => {
    const option = buildSankeyOption(base)
    expect(series(option).layoutIterations).toBe(0)
    expect(series(option).data.map((item) => [item.name, item.depth])).toEqual([
      ['income', 0],
      ['main:wohnen', 1],
      ['main:leben', 1],
      ['balance', 1],
      ['sub:miete', 2],
      ['sub:strom', 2],
      ['sub:essen', 2],
    ])
  })

  it('drops links ≤ 0 and nodes without flows', () => {
    const option = buildSankeyOption(base)
    expect(series(option).links).toHaveLength(6)
    expect(series(option).data.some((item) => item.name === 'main:leer')).toBe(false)
  })

  it('uses category colours, gradient flows and slim rounded blocks', () => {
    const option = buildSankeyOption(base)
    expect(node(option, 'main:wohnen').itemStyle.color).toBe('color-main:wohnen')
    expect(series(option).lineStyle.color).toBe('gradient')
    expect(series(option).itemStyle.borderRadius).toBeGreaterThan(0)
    expect(series(option).emphasis.focus).toBe('adjacency')
  })

  it('labels name and amount, or share of income after switching to %', () => {
    const format = (option: ReturnType<typeof buildSankeyOption>) =>
      series(option).label.formatter({ name: 'main:wohnen' })
    expect(format(buildSankeyOption(base))).toBe('{name|Wohnen}  {value|900,00 €}')
    expect(format(buildSankeyOption({ ...base, unit: 'pct' }))).toBe(
      '{name|Wohnen}  {value|60,00 %}',
    )
  })

  it('hides the label of a block too small to hold one', () => {
    const option = buildSankeyOption(base)
    expect(node(option, 'sub:strom').label.show).toBe(false)
    expect(node(option, 'sub:miete').label.show).toBe(true)
  })

  it('shows amount and share in an escaped German tooltip', () => {
    const tooltip = buildSankeyOption(base).tooltip.formatter
    expect(tooltip({ dataType: 'node', name: 'sub:strom', value: 100 })).toBe(
      'Strom &lt;Stadtwerke&gt;<br/><b>1,00 €</b> · 0,07 % der Einnahmen',
    )
    expect(
      tooltip({ dataType: 'edge', data: { source: 'income', target: 'balance' }, value: 20000 }),
    ).toContain('Einnahmen → Gespart')
  })

  it('outlines the selected block and turns animation off for reduced motion', () => {
    const option = buildSankeyOption({ ...base, selectedNodeId: 'main:leben', reducedMotion: true })
    expect(node(option, 'main:leben').itemStyle).toMatchObject({ borderWidth: 2 })
    expect(option.animation).toBe(false)
  })

  it('totals a block by its incoming flows, the income block by its outgoing ones', () => {
    const totals = sankeyNodeTotals(links)
    expect(totals.get('income')).toBe(150000)
    expect(totals.get('main:wohnen')).toBe(90000)
  })
})
