# Data Model: Merchant Logos (008)

## recipient_logo (new, migration 0011)

| Column | Type | Rules |
|---|---|---|
| recipient_key | text PK | 1–200 characters; `recipientKey()` of research R5 |
| mode | text not null | `brand` \| `none` \| `upload` (CHECK) |
| brand_slug | text null | required when mode = `brand`, else null (CHECK); must exist in the catalogue when saved |
| file_name | text null | required when mode = `upload`, else null (CHECK); `<uuid>.<png\|jpg\|webp>` |
| updated_at | text not null | ISO timestamp, default now |

- No foreign key: one row serves all bookings with that key, also future ones.
- Deleting the row = "Automatisch".
- On `upload` replace/delete the previous file is removed from disk.

## Brand (built in, not stored)

| Field | Source |
|---|---|
| slug | simple-icons slug |
| title | simple-icons title |
| hex | simple-icons hex (6 digits) |
| aliases | curated list (`domain/brands.ts`), only for auto-matching and extra search words |

## LogoRef (API → web, part of TransactionListItem)

```text
logo: null
    | { kind: 'brand', slug, title, hex, url }      # url = /api/logos/brands/<slug>.svg?v=<version>
    | { kind: 'upload', url }                       # url = /api/logos/files/<file_name>
logoSource: 'auto' | 'manual' | null                # for the picker ("Automatisch erkannt")
recipientKey: string | null                         # key the picker writes to
```

## State transitions (per recipient)

```text
(no row) --choose brand--> brand --choose other brand--> brand
(no row) --Kein Logo--> none
any --upload--> upload (old file deleted)
any --Automatisch--> (no row) (file deleted if upload)
```
