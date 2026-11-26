import { z } from 'zod'
import { SOURCE_KINDS, SOURCE_STATUSES } from '../enums.js'

/** `GET /api/sources` item; credentials are never part of it. */
export const dataSourceDto = z.object({
  id: z.string(),
  kind: z.enum(SOURCE_KINDS),
  status: z.enum(SOURCE_STATUSES),
  displayName: z.string(),
  lastSyncAt: z.string().nullable(),
  lastError: z.string().nullable(),
  /** Latest sync run (004 US1); null before the first run. */
  lastRun: z
    .object({
      status: z.enum(['running', 'succeeded', 'partial', 'failed']),
      imported: z.number().int().min(0),
      skipped: z.number().int().min(0),
      finishedAt: z.string().nullable(),
    })
    .nullable()
    .optional(),
  /** Daily sync switched on in the server configuration (read-only in the UI). */
  dailySync: z.boolean().optional(),
  /** Bank consent end (005 US1); null when no consent is stored. */
  consentEndsAt: z.string().nullable().optional(),
  /** True from 14 days before the consent ends. */
  consentWarning: z.boolean().optional(),
  /** Bank name the consent was given at. */
  institution: z.string().nullable().optional(),
  /** Accounts approved in the bank consent. */
  accounts: z
    .array(z.object({ id: z.string(), name: z.string(), maskedIban: z.string().nullable() }))
    .optional(),
})
export type DataSourceDto = z.infer<typeof dataSourceDto>

/** `POST /api/sources/:id/sync` → 202. */
export const syncStarted = z.object({ runId: z.string() })
export type SyncStarted = z.infer<typeof syncStarted>

/** `POST /api/sources/scalable/connect`: Scalable's own login page, or already connected. */
export const connectResponse = z.object({
  authorizationUrl: z.string().nullable(),
  connected: z.boolean(),
})
export type ConnectResponse = z.infer<typeof connectResponse>

/** `GET /api/sources/bank/institutions`: banks offered by Enable Banking (005 US1). */
export const bankInstitution = z.object({
  name: z.string(),
  country: z.string().length(2),
  logo: z.string().nullable(),
})
export type BankInstitution = z.infer<typeof bankInstitution>

/** `POST /api/sources/bank/connect` body. */
export const bankConnectRequest = z.object({
  aspspName: z.string().trim().min(1).max(200),
  aspspCountry: z.string().trim().toUpperCase().length(2),
})
export type BankConnectRequest = z.infer<typeof bankConnectRequest>

/** `POST /api/sources/bank/connect` → the bank's login page. */
export const bankConnectResponse = z.object({ authorizationUrl: z.string() })
export type BankConnectResponse = z.infer<typeof bankConnectResponse>
