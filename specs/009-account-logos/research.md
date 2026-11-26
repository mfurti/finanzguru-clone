# Research: Logos for Banks, Brokers, Portfolios and Accounts (009)

## R1 – Where missing logos come from

- **Decision**: a local, git-ignored logo folder read at API start (set `local`), filled by the owner or a helper session with the owner's OK per download (official press/brand pages).
- **Rationale**: the free sets lack Scalable Capital, ING, DKB, comdirect, Consorsbank, Volksbank, Postbank, flatex, Trading 212, Bitpanda (checked 2026-11-26; only the outline set `arcticons`, CC-BY-SA, has some). Official logos carry no free licence; the app is private and local, the repo public only for CI minutes → keep the files out of git.
- **Alternatives**: commit the logos (would publish unlicensed trademarks); `arcticons` (outline style, partial coverage); per-institution upload only (works, but each logo would need a manual upload; the folder also serves merchant logos).

## R2 – Local folder format

- **Decision**: `brand-logos/brands.json` = array of `{ "key": "scalable-capital", "title": "Scalable Capital", "words": ["scalable capital", "scalable"], "file": "scalable-capital.png" }`; files PNG, JPEG, WebP (magic bytes) or SVG (008 safety check), each ≤ 256 KB; `key` `^[a-z0-9-]{1,60}$`; `words` 1–10 entries, 1–60 characters. Folder: `BRAND_LOGOS_DIR`, default `dirname(DATABASE_PATH)/brand-logos`. Invalid entries are skipped with one warning each; a missing folder is fine.
- **Rationale**: one small file the owner can edit by hand; same limits as 008 uploads.

## R3 – Priority

- **Decision**: brand keys `local:<key>`; local aliases are checked before built-in aliases of the same word count (longest alias still wins first). In the picker, local brands come first.
- **Rationale**: the owner's local logo should beat a built-in one for the same words (spec FR-004).

## R4 – Institution choice storage

- **Decision**: reuse `recipient_logo` with key `institution:<institutionId>`; routes `PUT/DELETE /api/logos/recipients/:key` and `/upload` unchanged.
- **Rationale**: no migration, same picker and upload code. Booking recipient keys never start with `institution:` (they are normalized names, `iban:` or `purpose:`).
- **Alternatives**: `institution.logo_key` column (would need mode/file columns → migration and duplicate code).

## R5 – Web data flow

- **Decision**: `GET /api/accounts` returns the logo fields; a composable caches that list (`key: 'accounts'`, already shared) and offers `byAccount(id)` and `byInstitution(name)`.
- **Rationale**: the tree, overview and detail endpoints all carry account ids or institution names, so no further API changes.
