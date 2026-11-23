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
