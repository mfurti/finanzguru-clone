import { z } from 'zod'

export const tagInput = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().trim().min(1).max(30).default('neutral'),
})
export type TagInput = z.infer<typeof tagInput>
export const updateTagInput = tagInput.partial()
export type UpdateTagInput = z.infer<typeof updateTagInput>

export const tagDto = z.object({
  id: z.string(),
  name: z.string(),
  color: z.string(),
  usage: z.number().int().min(0),
})
export type TagDto = z.infer<typeof tagDto>
