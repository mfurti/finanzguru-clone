import { z } from 'zod'
import { INSURANCE_TYPES, PREMIUM_INTERVALS } from '../enums.js'
import { cents, isoDate } from './common.js'

export const insuranceInput = z
  .object({
    type: z.enum(INSURANCE_TYPES),
    provider: z.string().trim().min(1).max(120),
    contractNumber: z.string().trim().max(60).nullable().optional(),
    premiumCents: z.number().int().positive(),
    interval: z.enum(PREMIUM_INTERVALS),
    startDate: isoDate,
    endDate: isoDate.nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    linkedCategoryId: z.string().nullable().optional(),
  })
  .refine((value) => !value.endDate || value.endDate >= value.startDate, {
    message: 'Ende muss nach dem Beginn liegen',
    path: ['endDate'],
  })
export type InsuranceInput = z.infer<typeof insuranceInput>

export const insuranceDto = z.object({
  id: z.string(),
  type: z.enum(INSURANCE_TYPES),
  provider: z.string(),
  contractNumber: z.string().nullable(),
  premiumCents: cents,
  interval: z.enum(PREMIUM_INTERVALS),
  startDate: isoDate,
  endDate: isoDate.nullable(),
  notes: z.string().nullable(),
  linkedCategoryId: z.string().nullable(),
  /** premium × {12, 4, 2, 1} */
  yearlyCostCents: cents,
})
export type InsuranceDto = z.infer<typeof insuranceDto>

/** Contract suggested from recurring bookings in the Versicherung categories (012 P14). */
export const insuranceSuggestionDto = z.object({
  key: z.string().min(1).max(200),
  counterparty: z.string(),
  amountCents: cents,
  interval: z.enum(PREMIUM_INTERVALS),
  type: z.enum(INSURANCE_TYPES),
  count: z.number().int(),
  firstDate: isoDate,
  lastDate: isoDate,
})
export type InsuranceSuggestionDto = z.infer<typeof insuranceSuggestionDto>
