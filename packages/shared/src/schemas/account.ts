import { z } from 'zod'
import { ACCOUNT_TYPES } from '../enums.js'
import { cents } from './common.js'
import { logoRef, logoSource } from './logo.js'

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
  /** Bank or broker logo (009): brand, local or upload; null = initials. */
  logo: logoRef,
  logoSource,
  /** Key the institution's logo choice is stored under (`institution:<id>`); null for "Manuell". */
  logoKey: z.string().max(200).nullable(),
})
export type AccountDto = z.infer<typeof accountDto>

const accountFields = {
  name: z.string().trim().min(1).max(80),
  type: accountType,
  institutionName: z.string().trim().min(1).max(80),
  iban: z
    .string()
    .trim()
    .transform((value) => value.replace(/\s+/g, '').toUpperCase())
    .optional(),
  balanceCents: cents,
  parentAccountId: z.string().optional(),
}

/** Manual account creation (FR-056); IBAN checksum is validated in the API. */
export const createAccountInput = z.object({
  ...accountFields,
  institutionName: accountFields.institutionName.default('Manuell'),
  balanceCents: accountFields.balanceCents.default(0),
})
export type CreateAccountInput = z.infer<typeof createAccountInput>

/** No defaults: a PATCH must not reset fields it did not send (e.g. the balance). */
export const updateAccountInput = z
  .object(accountFields)
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
