# Research: Merchant Logos (008)

## R1 – Logo source

- **Decision**: `simple-icons` npm package (CC0, ≈ 3 300 brands, title + hex + SVG path), used by the API only.
- **Rationale**: offline, licence-free, single source for search and rendering; checked 2026-11-25 that 31 of 35 relevant German brands exist (ING, Lieferando, Tchibo, Flixbus missing → uploads). Correction 2026-11-26 (T005): Amazon is not in the installed package either (removed at the brand's request; the CDN check used an older copy) → upload.
- **Alternatives**: logo.dev / Brandfetch / Google or DuckDuckGo favicons – coloured real logos, but every merchant name or domain goes to a third party (violates principle II); Clearbit's free logo API is discontinued. `@iconify-json/simple-icons` in the web bundle – same data, but either a large client bundle or Nuxt icon server bundle without brand colours; serving from the API is simpler.

## R2 – Rendering and colour

- **Decision**: `GET /api/logos/brands/:slug.svg?v=<pkgVersion>` returns the glyph with `fill="#<hex>"`; web shows it in a round white tile with a subtle border (both themes), glyph ≈ 60 % of the tile.
- **Rationale**: dark brand colours (Apple, Uber black) stay visible in dark mode; identical size to the initials avatar → no layout shift; `<img>` SVGs cannot run scripts; long cache with version key.
- **Alternatives**: inline SVG in the list response (bigger payloads); brand-coloured tile with white glyph (poor for light brand colours like Lidl yellow).

## R3 – Matching

- **Decision**: curated alias list `{ slug, aliases[] }` in `domain/brands.ts`; recipient text normalized like 006 (`normalizeText`: NFKC, lower case, single spaces, umlauts kept) then tokenized; an alias (one or more words) matches when its words appear as consecutive whole words. Order: longest alias first (e.g. "aldi sud" before "aldi"). Matching uses counterparty, else the purpose part after " · " (card payments).
- **Rationale**: whole words avoid "dm" in "Admiral", "otto" in "Ottobrunn"; explicit aliases avoid false positives from matching all 3 300 titles.
- **Examples**: "rewe" → rewe; "lidl" → lidl; "aldi nord", "aldi" → aldinord; "aldi sud", "aldi süd" → aldisud; "paypal" → paypal; "klarna" → klarna; "netflix"; "spotify"; "db vertrieb", "deutsche bahn" → deutschebahn; "vodafone"; "telekom", "telekom deutschland" → deutschetelekom; "o2", "telefonica" → o2; "ikea"; "shell"; "aral"; "sparkasse"; "n26"; "apple"; "google"; "mcdonalds", "mc donalds" → mcdonalds; "burger king" → burgerking; "zalando"; "ebay"; "otto"; "rossmann"; "uber"; "edeka"; "dm drogerie", "dm-drogerie", "dm" → dm; "kaufland"; "netto"; "penny".
- **Alternatives**: fuzzy matching against all titles (too many false positives); online merchant databases (privacy).

## R4 – Uploads

- **Decision**: multipart, max 256 KB (route-level limit), type by magic bytes (PNG `89 50 4E 47`, JPEG `FF D8 FF`, WebP `RIFF....WEBP`), SVG refused; stored as `<uuid>.<png|jpg|webp>` in `dirname(DATABASE_PATH)/logos/`; old file deleted on replace/remove; served by `GET /api/logos/files/:name` behind the session guard with `Content-Type` from extension, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=86400`; name validated against `^[0-9a-f-]{36}\.(png|jpg|webp)$` (no path traversal).
- **Rationale**: small files keep lists fast and backups small; no server-side image library needed; display uses CSS `object-fit: cover` in the round tile.
- **Alternatives**: store as BLOB in SQLite (bloats DB, every list query heavier); resize with sharp (native dependency, not needed at 256 KB).

## R5 – Recipient key

- **Decision**: `recipientKey(tx)` = `counterpartyKey` (006), else `iban:<IBAN>`, else `purpose:<normalized purpose part, 40 chars>` – the same fallback order as `draftRuleFor`. Stored as text primary key (max 200).
- **Rationale**: logo choices and category rules address the same recipient; works for card payments without counterparty.

## R6 – Which bookings get logos

- **Decision**: types income, expense, fee, interest, tax, deposit, withdrawal; others `logo: null` (web keeps its existing icon/initials).
- **Rationale**: transfers and trades are not merchants (FR-009).

## R7 – Licence note

- **Decision**: Settings › Datenquellen footer (existing "Über" area) shows "Markenlogos: Simple Icons (CC0). Marken sind Eigentum ihrer Inhaber."
