import { z } from 'zod'
import { cents } from './common.js'

export const accountOverviewRow = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  institution: z.string(),
  initials: z.string(),
  ibanMasked: z.string().nullable(),
  iban: z.string().nullable(),
  /** Last 30 days of the balance in cents (at least 2 points). */
  sparkline: z.array(cents),
  lastUpdateAt: z.string().nullable(),
  lastUpdateKind: z.enum(['sync', 'import']).nullable(),
  canSync: z.boolean(),
  balanceCents: cents,
  /**
   * Balance check (013): the source's last balance and the difference to "previous balance +
   * bookings since"; null = nothing to compare (manual, CSV or first sync).
   */
  balanceCheck: z.object({ sourceCents: cents, at: z.string(), differenceCents: cents }).nullable(),
})
export type AccountOverviewRow = z.infer<typeof accountOverviewRow>

/** `GET /api/accounts/overview` (US2). */
export const accountsOverview = z.object({
  groups: z.array(
    z.object({
      kind: z.enum(['depot', 'account']),
      totalCents: cents,
      rows: z.array(accountOverviewRow),
    }),
  ),
})
export type AccountsOverview = z.infer<typeof accountsOverview>

/** `GET /api/accounts/:id/detail` (US2). */
export const accountDetail = z.object({
  account: accountOverviewRow,
  history: z.array(z.object({ date: z.string(), valueCents: cents })),
  figures: z.object({
    balanceCents: cents,
    changeCents: cents,
    inflowCents: cents,
    outflowCents: cents,
  }),
})
export type AccountDetail = z.infer<typeof accountDetail>
