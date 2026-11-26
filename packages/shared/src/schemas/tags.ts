import { z } from 'zod'

const tagFields = {
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().min(1).max(30),
}
export const tagInput = z.object({ ...tagFields, color: tagFields.color.default('neutral') })
export type TagInput = z.infer<typeof tagInput>
/** No defaults: renaming must not reset the color. */
export const updateTagInput = z.object(tagFields).partial()
export type UpdateTagInput = z.infer<typeof updateTagInput>

export const tagDto = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  usage: z.number().int().min(0),
})
export type TagDto = z.infer<typeof tagDto>
