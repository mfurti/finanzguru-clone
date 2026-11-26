import { use } from 'echarts/core'
import { SankeyChart } from 'echarts/charts'
import { TooltipComponent } from 'echarts/components'
import { SVGRenderer } from 'echarts/renderers'

let registered = false

/**
 * Registers only the ECharts parts the app uses (011 R1): the sankey series,
 * the tooltip and the SVG renderer. Tree-shaken, so pages without a Sankey do
 * not load ECharts. Safe to call more than once.
 */
export function registerSankeyCharts(): void {
  if (registered) return
  use([SankeyChart, TooltipComponent, SVGRenderer])
  registered = true
}
