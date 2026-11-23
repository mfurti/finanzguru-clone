import { z } from 'zod'
import { ACCOUNT_TYPES } from '../enums.js'
import { cents } from './common.js'

export const accountType = z.enum(ACCOUNT_TYPES)

export const accountDto = z.object({
  id: z.string(),
  institutionId: z.string(),
  institutionName: z.string(),
  name: z.string().min(1).max(80),
  type: accountType,
  iban: z.string().nullable(),
  parentAccountId: z.string().nullable(),
  balanceCents: cents,
  isHidden: z.boolean(),
  sortOrder: z.number().int(),
  lastSyncedAt: z.string().nullable(),
})
export type AccountDto = z.infer<typeof accountDto>

/** Manual account creation (FR-056); IBAN checksum is validated in the API. */
export const createAccountInput = z.object({
  name: z.string().trim().min(1).max(80),
  type: accountType,
  institutionName: z.string().trim().min(1).max(80).default('Manuell'),
  iban: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, '').toUpperCase())
    .optional(),
  balanceCents: cents.default(0),
  parentAccountId: z.string().optional(),
})
export type CreateAccountInput = z.infer<typeof createAccountInput>

export const updateAccountInput = createAccountInput
  .omit({ institutionName: true })
  .partial()
  .extend({ isHidden: z.boolean().optional(), sortOrder: z.number().int().optional() })
export type UpdateAccountInput = z.infer<typeof updateAccountInput>

/** Node of `GET /api/accounts/tree`. */
export interface AccountTreeItem {
  id: string
  name: string
  institution: string
  logoKey: string | null
  valueCents: number
  children?: AccountTreeItem[]
}

export const accountTreeItem: z.ZodType<AccountTreeItem> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    institution: z.string(),
    logoKey: z.string().nullable(),
    valueCents: cents,
    children: z.array(accountTreeItem).optional(),
  }),
)

export const accountTree = z.object({
  groups: z.array(
    z.object({
      type: z.enum(['depots', 'accounts']),
      totalCents: cents,
      items: z.array(accountTreeItem),
    }),
  ),
})
export type AccountTree = z.infer<typeof accountTree>
