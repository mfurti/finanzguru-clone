import { z } from 'zod'
import { ASSET_CLASSES, PRICE_SOURCES } from '../enums.js'
import { decimalString, isoDate } from './common.js'

export const assetClass = z.enum(ASSET_CLASSES)

export const instrumentDto = z.object({
  id: z.string(),
  isin: z.string().length(12),
  wkn: z.string().length(6).nullable(),
  name: z.string().min(1),
  assetClass,
  currency: z.string().length(3),
})
export type InstrumentDto = z.infer<typeof instrumentDto>

export const priceDto = z.object({
  date: isoDate,
  close: decimalString,
  source: z.enum(PRICE_SOURCES),
})
export type PriceDto = z.infer<typeof priceDto>
