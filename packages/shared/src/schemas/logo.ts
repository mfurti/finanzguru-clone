import { z } from 'zod'

/**
 * Brand key of the built-in catalogue: `<set>:<name>` (008 R8), or a Simple Icons slug
 * without set as stored before.
 */
export const brandSlug = z.string().regex(/^(?:[a-z0-9-]{1,30}:)?[a-z0-9-]{1,80}$/)

/** Normalized recipient key (008 R5): counterparty, else `iban:…`, else `purpose:…`. */
export const recipientKey = z.string().min(1).max(200)

/** Logo of a booking's recipient (008): built-in brand or own upload; null = initials. */
export const logoRef = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('brand'),
      slug: brandSlug,
      title: z.string(),
      /** Brand colour of a glyph, 6 hex digits without "#"; null for coloured logos. */
      hex: z
        .string()
        .regex(/^[0-9A-F]{6}$/)
        .nullable(),
      url: z.string(),
    }),
    z.object({ kind: z.literal('upload'), url: z.string() }),
  ])
  .nullable()
export type LogoRef = z.infer<typeof logoRef>

/** How the logo came about: alias match, owner's choice, or none. */
export const logoSource = z.enum(['auto', 'manual']).nullable()
export type LogoSource = z.infer<typeof logoSource>

/** `PUT /api/logos/recipients/:key`: a brand, or "Kein Logo". */
export const recipientLogoInput = z
  .object({ mode: z.enum(['brand', 'none']), brandSlug: brandSlug.optional() })
  .refine((input) => (input.mode === 'brand') === (input.brandSlug !== undefined), {
    message: 'Marke nur bei mode "brand" angeben',
    path: ['brandSlug'],
  })
export type RecipientLogoInput = z.infer<typeof recipientLogoInput>

/** One hit of `GET /api/logos/brands?q=`. */
export const brandSearchResult = z.object({
  slug: brandSlug,
  title: z.string(),
  hex: z.string().nullable(),
  url: z.string(),
})
export type BrandSearchResult = z.infer<typeof brandSearchResult>

export const brandSearchQuery = z.object({
  q: z.string().trim().max(60).default(''),
  limit: z.coerce.number().int().min(1).max(60).default(40),
})
export type BrandSearchQuery = z.infer<typeof brandSearchQuery>
