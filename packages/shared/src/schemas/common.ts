import { z } from 'zod'
import { PERIODS } from '../enums.js'

/** `YYYY-MM-DD` calendar date that actually exists. */
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`)
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
  }, 'Invalid calendar date')

/** Money as integer cents (EUR). */
export const cents = z.number().int().safe()

/** Decimal number as string (quantities, prices, rates), parsed with decimal.js. */
export const decimalString = z.string().regex(/^-?\d+(\.\d+)?$/, 'Expected a decimal string')

/** Rate as decimal string or null when not computable (KPIs). */
export const nullableRate = decimalString.nullable()

export const period = z.enum(PERIODS)

/** Comma-separated account ids in a query string; omitted = all visible accounts. */
export const accountsParam = z
  .string()
  .optional()
  .transform((value) =>
    value
      ? value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : undefined,
  )

/** Common query: `accounts`, `period`, optional `from`/`to` overriding `period`. */
export const rangeQuery = z
  .object({
    accounts: accountsParam,
    period: period.default('1Y'),
    from: isoDate.optional(),
    to: isoDate.optional(),
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    message: '`from` must not be after `to`',
    path: ['from'],
  })
export type RangeQuery = z.infer<typeof rangeQuery>

export const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
})

export const paged = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int().min(0) })

/** Error body produced by the API's exception filter. */
export const apiError = z.object({
  statusCode: z.number().int(),
  statusMessage: z.string(),
  data: z
    .object({ issues: z.array(z.object({ path: z.string(), message: z.string() })).optional() })
    .optional(),
})
export type ApiError = z.infer<typeof apiError>
