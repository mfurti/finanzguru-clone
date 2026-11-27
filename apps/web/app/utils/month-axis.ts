const MONTH = new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: 'UTC' })

export interface AxisLabels {
  /** One label per bar; a space separates the month line from the year line. */
  labels: string[]
  /** x positions (between two bars) where a new year starts. */
  dividers: number[]
}

/**
 * Month axis like the reference (007 R6): month on the first line, the year as a second line
 * only at January or the first bar, and a divider where the year changes. Quarters show
 * "Q1"…"Q4", years only the year (no second line, no divider).
 */
export function monthAxis(
  bars: readonly { from: string; to?: string }[],
  granularity: 'month' | 'quarter' | 'year' = 'month',
): AxisLabels {
  const labels: string[] = []
  const dividers: number[] = []
  bars.forEach((bar, index) => {
    // The labelled month is the one a period ends in (a budget month may start on the 25th, 014).
    const date = new Date(`${bar.to ?? bar.from}T00:00:00Z`)
    const year = String(date.getUTCFullYear())
    const month = date.getUTCMonth()
    if (granularity === 'year') {
      labels.push(year)
      return
    }
    const head =
      granularity === 'quarter'
        ? `Q${Math.floor(month / 3) + 1}`
        : MONTH.format(date).replace('.', '')
    const newYear = month === 0
    labels.push(index === 0 || newYear ? `${head} ${year}` : head)
    if (index > 0 && newYear) dividers.push(index - 0.5)
  })
  return { labels, dividers }
}
