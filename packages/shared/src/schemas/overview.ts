import { z } from 'zod'
import { WIDGET_KEYS } from '../enums.js'
import { accountsParam, cents, isoDate, nullableRate, period } from './common.js'

export const widgetLayoutItem = z.object({
  widgetKey: z.enum(WIDGET_KEYS),
  position: z.number().int().min(0),
  visible: z.boolean(),
})
export type WidgetLayoutItem = z.infer<typeof widgetLayoutItem>

/** PUT body: every widget exactly once. */
export const dashboardLayoutInput = z
  .array(widgetLayoutItem)
  .length(WIDGET_KEYS.length)
  .refine((items) => new Set(items.map((item) => item.widgetKey)).size === items.length, {
    message: 'Each widget must appear exactly once',
  })
export type DashboardLayoutInput = z.infer<typeof dashboardLayoutInput>

export const netWorthQuery = z.object({
  accounts: accountsParam,
  period: period.default('1Y'),
  from: isoDate.optional(),
  to: isoDate.optional(),
  mode: z.enum(['value', 'return']).default('value'),
})
export type NetWorthQuery = z.infer<typeof netWorthQuery>

export const netWorthPoint = z.object({
  date: isoDate,
  valueCents: cents,
  investedCents: cents,
  cashCents: cents,
  /** Cumulative time-weighted return since the start of the range. */
  returnPct: nullableRate,
})
export type NetWorthPoint = z.infer<typeof netWorthPoint>

export const netWorthResponse = z.object({
  totalCents: cents,
  gainCents: cents,
  gainPct: nullableRate,
  series: z.array(netWorthPoint),
})
export type NetWorthResponse = z.infer<typeof netWorthResponse>

export const allocationQuery = z.object({
  accounts: accountsParam,
  unit: z.enum(['eur', 'pct']).default('eur'),
})

export const allocationResponse = z.object({
  totalCents: cents,
  slices: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      count: z.number().int(),
      valueCents: cents,
      pct: nullableRate,
    }),
  ),
})
export type AllocationResponse = z.infer<typeof allocationResponse>

export const kpiQuery = z.object({
  accounts: accountsParam,
  period: period.default('1Y'),
  from: isoDate.optional(),
  to: isoDate.optional(),
})

const grossNet = z.object({ grossCents: cents, netCents: cents })

export const kpiResponse = z.object({
  investedCents: cents,
  priceGain: z.object({ cents, pct: nullableRate }),
  realized: z.object({ grossCents: cents, netCents: cents, pct: nullableRate }),
  otherGainsCents: cents,
  dividends: grossNet,
  interest: grossNet,
  taxesFeesCents: cents,
  totalReturnCents: cents,
  twror: nullableRate,
  irr: nullableRate,
  inflation: nullableRate,
  realReturn: nullableRate,
})
export type KpiResponse = z.infer<typeof kpiResponse>

export const holdingsQuery = z.object({
  accounts: accountsParam,
  range: z.enum(['1D', '1W', '1M', '1Y']).default('1D'),
})

export const holding = z.object({
  instrumentId: z.string(),
  name: z.string(),
  priceCents: cents,
  changePct: nullableRate,
  changeCents: cents,
})
export type Holding = z.infer<typeof holding>

export const topFlopResponse = z.object({ top: z.array(holding), flop: z.array(holding) })
export type TopFlopResponse = z.infer<typeof topFlopResponse>
