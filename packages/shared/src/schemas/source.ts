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
