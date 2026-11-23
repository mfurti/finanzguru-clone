import { z } from 'zod'
import {
  AMOUNT_SIGNS,
  IMPORT_JOB_KINDS,
  IMPORT_JOB_STATUSES,
  RULE_MATCH_FIELDS,
  RULE_OPERATORS,
} from '../enums.js'

export const rowError = z.object({ line: z.number().int().optional(), reason: z.string() })

export const importJobDto = z.object({
  id: z.string(),
  sourceId: z.string(),
  kind: z.enum(IMPORT_JOB_KINDS),
  fileName: z.string().nullable(),
  format: z.string().nullable(),
  accountId: z.string().nullable(),
  status: z.enum(IMPORT_JOB_STATUSES),
  imported: z.number().int(),
  skipped: z.number().int(),
  failed: z.number().int(),
  errors: z.array(rowError),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
})
export type ImportJobDto = z.infer<typeof importJobDto>

export const csvMappingColumns = z.object({
  date: z.number().int().min(0),
  amount: z.number().int().min(0),
  valueDate: z.number().int().min(0).optional(),
  counterparty: z.number().int().min(0).optional(),
  iban: z.number().int().min(0).optional(),
  purpose: z.number().int().min(0).optional(),
  isin: z.number().int().min(0).optional(),
  quantity: z.number().int().min(0).optional(),
  price: z.number().int().min(0).optional(),
  fee: z.number().int().min(0).optional(),
  tax: z.number().int().min(0).optional(),
  type: z.number().int().min(0).optional(),
})

export const csvMappingInput = z.object({
  delimiter: z.enum([';', ',', '\t']),
  encoding: z.enum(['utf-8', 'windows-1252']),
  dateFormat: z.enum(['DD.MM.YYYY', 'DD.MM.YY', 'YYYY-MM-DD']),
  decimalSeparator: z.enum([',', '.']),
  skipRows: z.number().int().min(0).max(50).default(0),
  columns: csvMappingColumns,
})
export type CsvMappingInput = z.infer<typeof csvMappingInput>

export const csvMappingDto = csvMappingInput.extend({
  id: z.string(),
  name: z.string(),
  headerSignature: z.string(),
  defaultAccountId: z.string().nullable(),
})
export type CsvMappingDto = z.infer<typeof csvMappingDto>

/** Response of `POST /api/import/csv` (upload step). */
export const csvUploadResponse = z.object({
  jobId: z.string(),
  detectedFormat: z.string().nullable(),
  needsMapping: z.boolean(),
  headers: z.array(z.string()),
  preview: z.array(z.array(z.string())),
  delimiter: z.string(),
  encoding: z.string(),
})
export type CsvUploadResponse = z.infer<typeof csvUploadResponse>

/** Body of `POST /api/import/csv/:jobId/confirm`. */
export const csvConfirmInput = z.object({
  accountId: z.string().optional(),
  /** Price list without an ISIN column: the instrument the prices belong to. */
  instrumentId: z.string().optional(),
  mapping: csvMappingInput.optional(),
  saveMappingAs: z.string().trim().min(1).max(60).optional(),
})
export type CsvConfirmInput = z.infer<typeof csvConfirmInput>

export const categorizationRuleInput = z.object({
  matchField: z.enum(RULE_MATCH_FIELDS),
  operator: z.enum(RULE_OPERATORS),
  pattern: z.string().trim().min(1).max(200),
  amountSign: z.enum(AMOUNT_SIGNS).nullable().optional(),
  categoryId: z.string().min(1),
  enabled: z.boolean().default(true),
})
export type CategorizationRuleInput = z.infer<typeof categorizationRuleInput>

export const categorizationRuleDto = categorizationRuleInput.extend({
  id: z.string(),
  priority: z.number().int(),
})
export type CategorizationRuleDto = z.infer<typeof categorizationRuleDto>
