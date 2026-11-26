import { z } from 'zod'

export const searchQuery = z.object({ q: z.string().trim().min(2).max(100) })
export type SearchQuery = z.infer<typeof searchQuery>

export const searchHit = z.object({
  id: z.string(),
  label: z.string(),
  sub: z.string().optional(),
  /** App route to open. */
  to: z.string(),
})
export type SearchHit = z.infer<typeof searchHit>

/** `GET /api/search` (US7): at most 5 hits per group. */
export const searchResult = z.object({
  pages: z.array(searchHit),
  instruments: z.array(searchHit),
  accounts: z.array(searchHit),
  transactions: z.array(searchHit),
})
export type SearchResult = z.infer<typeof searchResult>
