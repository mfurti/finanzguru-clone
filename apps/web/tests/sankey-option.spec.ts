import { describe, expect, it } from 'vitest'
import {
  buildSankeyOption,
  isFiller,
  sankeyNodeTotals,
  sankeySafeColor,
} from '~/utils/sankey-option'

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
  colorOf: (id: string) =>
    id === 'sub:essen' ? 'color-mix(in oklab, #f00 80%, white)' : '#123456',
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
    expect(node(option, 'main:wohnen').itemStyle.color).toBe('#123456')
    // color-mix(…) cannot be animated by ECharts and falls back.
    expect(node(option, 'sub:essen').itemStyle.color).toBe('#9ca3af')
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

  it('cuts labels of the first two columns to the gap between columns', () => {
    const option = buildSankeyOption({ ...base, width: 560, labelSpace: 200 })
    expect(node(option, 'main:wohnen').label).toMatchObject({ overflow: 'truncate', width: 142 })
    expect(node(option, 'sub:miete').label).not.toHaveProperty('overflow')
  })

  it('passes only colours ECharts can animate (oklch broke the hover animation)', () => {
    expect(sankeySafeColor('rgb(1, 2, 3)', '#fff')).toBe('rgb(1, 2, 3)')
    expect(sankeySafeColor('#24272e', '#fff')).toBe('#24272e')
    expect(sankeySafeColor('oklch(70.5% 0.015 286.067)', '#fff')).toBe('#fff')
    const option = buildSankeyOption({ ...base, theme: { ...theme, muted: 'oklch(70% 0 0)' } })
    expect(series(option).label.rich.value.color).toBe('#9ca3af')
  })

  it('totals a block by its incoming flows, the income block by its outgoing ones', () => {
    const totals = sankeyNodeTotals(links)
    expect(totals.get('income')).toBe(150000)
    expect(totals.get('main:wohnen')).toBe(90000)
  })

  it('puts categories without sub categories and the balance at the bottom (012 P11)', () => {
    const option = buildSankeyOption({
      ...base,
      nodes: [...nodes, { id: 'main:none', label: 'Nicht kategorisiert', kind: 'main' as const }],
      links: [...links, { source: 'income', target: 'main:none', value: 95000 }],
    })
    const mains = series(option)
      .data.filter((item) => item.depth === 1)
      .map((item) => item.name)
    expect(mains).toEqual(['main:wohnen', 'main:leben', 'main:none', 'balance'])
  })

  it('fills a partly split main with an invisible block so no flow goes up (012 P11)', () => {
    const partly = [
      ...links.filter((link) => link.target !== 'sub:strom'),
      // Wohnen 900 € but its subs only 899 € → 1 € filler after Miete.
    ]
    const option = buildSankeyOption({ ...base, links: partly })
    const data = series(option).data
    const filler = data.find((item) => isFiller(item.name))!
    expect(filler).toMatchObject({ depth: 2, value: 100, label: { show: false } })
    expect(data.map((item) => item.name).indexOf(filler.name)).toBe(
      data.map((item) => item.name).indexOf('sub:miete') + 1,
    )
    const link = series(option).links.find((item) => isFiller(item.target))!
    expect(link).toMatchObject({ source: 'main:wohnen', value: 100, lineStyle: { opacity: 0 } })
    expect(series(option).tooltip).toBeUndefined()
    expect(option.tooltip.formatter({ dataType: 'node', name: filler.name, value: 100 })).toBe('')
  })

  it('stacks every sub block at or below its main block (no upward flow)', () => {
    const option = buildSankeyOption({
      ...base,
      nodes: [...nodes, { id: 'main:none', label: 'Nicht kategorisiert', kind: 'main' as const }],
      links: [
        ...links.filter((link) => link.target !== 'sub:strom'),
        { source: 'income', target: 'main:none', value: 95000 },
      ],
    })
    // ECharts with layout iterations 0 stacks each column from the top in data order.
    const gap = 12
    const top = new Map<string, number>()
    for (const depth of [1, 2]) {
      let y = 0
      for (const item of series(option).data.filter((row) => row.depth === depth)) {
        top.set(item.name, y)
        y += item.value + gap
      }
    }
    for (const link of series(option).links.filter((row) => !row.source.startsWith('income')))
      expect(top.get(link.target)!).toBeGreaterThanOrEqual(top.get(link.source)!)
  })
})
