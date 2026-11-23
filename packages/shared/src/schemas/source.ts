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
})
export type DataSourceDto = z.infer<typeof dataSourceDto>
