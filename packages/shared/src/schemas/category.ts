import { z } from 'zod'
import { CATEGORY_ICON_KEYS } from '../category-icons.js'
import { CATEGORY_KINDS } from '../enums.js'
import { cents } from './common.js'

export const categoryKind = z.enum(CATEGORY_KINDS)

export interface CategoryNode {
  id: string
  parentId: string | null
  name: string
  kind: z.infer<typeof categoryKind>
  color: string
  icon: string
  isDefault: boolean
  children: CategoryNode[]
}

export const categoryNode: z.ZodType<CategoryNode> = z.lazy(() =>
  z.object({
    id: z.string(),
    parentId: z.string().nullable(),
    name: z.string(),
    kind: categoryKind,
    color: z.string(),
    icon: z.string(),
    isDefault: z.boolean(),
    children: z.array(categoryNode),
  }),
)

const categoryFields = {
  parentId: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  kind: categoryKind,
  color: z.string().trim().min(1).max(30),
  icon: z.enum(CATEGORY_ICON_KEYS as [string, ...string[]]),
}

export const createCategoryInput = z.object({
  ...categoryFields,
  color: categoryFields.color.default('neutral'),
  icon: categoryFields.icon.default('tag'),
})
export type CreateCategoryInput = z.infer<typeof createCategoryInput>

/** No defaults here: a PATCH must not reset color or icon it did not send. */
export const updateCategoryInput = z.object(categoryFields).partial()
export type UpdateCategoryInput = z.infer<typeof updateCategoryInput>

export const budgetInput = z.object({
  categoryId: z.string().min(1),
  monthlyLimitCents: z.number().int().positive(),
})
export type BudgetInput = z.infer<typeof budgetInput>

export const budgetDto = budgetInput.extend({
  id: z.string(),
  categoryName: z.string(),
  color: z.string(),
  spentCents: z.number().int(),
  remainingCents: z.number().int(),
})
export type BudgetDto = z.infer<typeof budgetDto>

/** `GET /api/categories/:id/detail` (US3). */
export const categoryDetail = z.object({
  id: z.string(),
  name: z.string(),
  kind: categoryKind,
  color: z.string(),
  icon: z.string(),
  parentId: z.string().nullable(),
  totalCents: cents,
  history: z.array(z.object({ month: z.string(), cents })),
})
export type CategoryDetail = z.infer<typeof categoryDetail>

const budgetFigures = z.object({
  limitCents: cents,
  spentCents: cents,
  /** spent / limit as decimal string (e.g. "0.82"). */
  ratio: z.string(),
  diffCents: cents,
})
const budgetPoint = z.object({ budgetCents: cents.nullable(), spentCents: cents })

/** `GET /api/budgets/overview` (US4). */
export const budgetsOverview = z.object({
  period: z.string(),
  rows: z.array(
    budgetFigures.extend({
      id: z.string(),
      categoryId: z.string(),
      name: z.string(),
      icon: z.string(),
      color: z.string(),
    }),
  ),
  total: budgetFigures,
  series: z.array(
    z.object({
      month: z.string(),
      total: budgetPoint,
      byBudget: z.record(z.string(), budgetPoint),
    }),
  ),
})
export type BudgetsOverview = z.infer<typeof budgetsOverview>
