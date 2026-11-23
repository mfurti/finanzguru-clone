import { z } from 'zod'
import { CATEGORY_KINDS } from '../enums.js'

export const categoryKind = z.enum(CATEGORY_KINDS)

export interface CategoryNode {
  id: string
  parentId: string | null
  name: string
  kind: z.infer<typeof categoryKind>
  color: string
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
    isDefault: z.boolean(),
    children: z.array(categoryNode),
  }),
)

export const createCategoryInput = z.object({
  parentId: z.string().optional(),
  name: z.string().trim().min(1).max(60),
  kind: categoryKind,
  color: z.string().trim().min(1).max(30).default('neutral'),
})
export type CreateCategoryInput = z.infer<typeof createCategoryInput>

export const updateCategoryInput = createCategoryInput.partial()
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
