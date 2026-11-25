# Implementation Plan: Merchant Logos for Bookings

**Branch**: `8-merchant-logos` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-merchant-logos/spec.md`

## Summary

The API decides the logo of every booking and serves the images; the web app only renders them.

1. **Brand catalogue (US1)**: the `simple-icons` package (CC0) is a dependency of the API. A curated alias list in `apps/api/src/domain/brands.ts` maps recipient words to brand slugs (≈ 40 brands from the spec). `GET /api/logos/brands/:slug.svg` renders the glyph in its brand colour; same-origin `<img>`, so no web bundle growth and no external request.
2. **Logo rule (US1, US2)**: domain function `logoFor(recipientKey, choice)` → upload, else manual brand, else automatic alias match, else null; `none` suppresses the match. The transaction list (and every endpoint that returns `TransactionListItem`) adds `logo`.
3. **Choice per recipient (US2)**: table `recipient_logo` (migration 0011) keyed by the 006 recipient key; `PUT/DELETE /api/logos/recipients/:key`; brand search `GET /api/logos/brands?q=` over the whole catalogue (title + aliases).
4. **Uploads (US3)**: `POST /api/logos/recipients/:key/upload` (multipart, ≤ 256 KB, PNG/JPEG/WebP by magic bytes) stored in `<data dir>/logos/<uuid>.<ext>`; `GET /api/logos/files/:file` serves them to the logged-in owner.
5. **Web**: `MerchantLogo.vue` wraps `Avatar.vue` (fallback); used in `BookingsTable`, `BookingPanel` (with "Logo ändern" → `LogoPicker.vue`), `RuleSuggestions`; settings › about shows the CC0/trademark note.

## Technical Context

**Language/Version**: TypeScript 5 strict, Node 22

**Primary Dependencies**: API adds `simple-icons@16.38.1` (CC0, data + SVG paths, used server-side only). Existing: NestJS 11 Fastify, `@fastify/multipart`, Drizzle, zod 4, Nuxt 4, Nuxt UI 4.

**Storage**: SQLite migration `0011_recipient_logo`; image files in `dirname(DATABASE_PATH)/logos/` (git-ignored `data` dir, same place as the database).

**Testing**: vitest domain unit (alias matching, whole words, rule order), API e2e (list `logo`, choice CRUD, upload limits, file serving auth), component tests (`MerchantLogo`, `LogoPicker`), Playwright one journey per story at 1280 and 360 px.

**Target Platform**: local dev server (web 3100, API 3101).

**Project Type**: pnpm monorepo web app.

**Performance Goals**: list of 200 rows: matching is a map lookup per row (aliases compiled once at start); brand SVGs cached by the browser (`Cache-Control: public, max-age=31536000, immutable` with the package version in the URL).

**Constraints**: no request to any third-party host (FR-001); CSP `img-src 'self' data: blob:` already fits; no layout shift (007 guard) – logo tile has the same fixed size as the avatar.

**Scale/Scope**: ≈ 3 300 catalogue entries; ≈ 40 curated aliases; recipients of the owner a few hundred.

## Coding Standards

Same as feature 005 (`specs/005-bank-sync-market-data/plan.md` › Coding Standards). Gates per task commit: lint, format check, typecheck, API and web unit tests.

## Constitution Check

| Principle | Check | Status |
|---|---|---|
| I. Exact Money | No money logic touched | Pass |
| II. Owner-Controlled, Local Data | Logos bundled with the API, uploads stored in the local data dir; no external logo service (explicitly out of scope) | Pass |
| III. Public Repo Hygiene | Test fixtures use invented recipients; no real logos uploaded into the repo; data dir git-ignored | Pass |
| IV. Tested by Layer | Domain unit, API e2e, component, Playwright per story | Pass |
| V. Local First | Local dev server only; no deployment | Pass |
| VI. German, Responsive, Honest UI | German texts, 360 px, dark/light (white tile so dark brand colours stay visible), fallback initials, CC0/trademark note | Pass |

Post-design re-check: unchanged. Upload hardening (size, magic bytes, no SVG, random file names, auth on serving, `X-Content-Type-Options: nosniff`) covered in research R4.

## Project Structure

```text
specs/008-merchant-logos/ plan.md research.md data-model.md quickstart.md contracts/http-api.md tasks.md

packages/shared/src/schemas/logo.ts           # logoRef, recipientLogoInput, brandSearchResult
packages/shared/src/schemas/cashflow.ts       # TransactionListItem.logo
apps/api/src/domain/brands.ts                  # curated aliases → slug
apps/api/src/domain/logo.ts                    # recipientKey(), matchBrand(), logoFor()
apps/api/src/database/{schema.ts,migrations/0011_recipient_logo.sql}
apps/api/src/modules/logos/{logos.module.ts,logos.controller.ts,logos.service.ts,brand-catalog.ts}
apps/api/src/modules/transactions/transactions-review.service.ts   # list adds logo

apps/web/app/components/common/MerchantLogo.vue
apps/web/app/components/transactions/{LogoPicker.vue,BookingsTable.vue,BookingPanel.vue,RuleSuggestions.vue}
apps/web/app/pages/settings/… (about note)
```

## Complexity Tracking

No violations.
