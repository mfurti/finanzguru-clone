# Data Model: Logos for Banks, Brokers, Portfolios and Accounts (009)

No migration.

## recipient_logo (existing, 008)

Rows with `recipient_key = 'institution:<institutionId>'` hold the owner's choice for an institution (mode `brand` | `none` | `upload`, same checks as 008).

## Local brand (file system, not versioned)

`<BRAND_LOGOS_DIR or dirname(DATABASE_PATH)/brand-logos>/brands.json`:

| Field | Rule |
|---|---|
| key | `^[a-z0-9-]{1,60}$`, unique; brand key becomes `local:<key>` |
| title | 1–60 characters |
| words | 1–10 entries, each 1–60 characters; matched as whole words (008 R3) |
| file | file name in the same folder, `^[a-zA-Z0-9._-]{1,80}$`; PNG/JPEG/WebP by content or SVG passing the 008 safety check; ≤ 256 KB |

## AccountDto (changed)

Adds `logo: LogoRef`, `logoSource: 'auto' | 'manual' | null`, `logoKey: string` (`institution:<institutionId>`; null for institution "Manuell").

## Unused

`institution.logo_key` stays unused (kept to avoid a migration; documented here).
