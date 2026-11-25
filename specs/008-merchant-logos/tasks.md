# Tasks: Merchant Logos for Bookings

**Input**: Design documents from `specs/008-merchant-logos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included (Constitution IV): domain unit, API e2e, component tests, one Playwright journey per story.

**Standards**: plan.md › Coding Standards. Gates before each commit: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, API and web unit tests.

**Commits**: One commit per task, pushed immediately; issue checklist synced. No deployment tasks.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Add `simple-icons@16.38.1` (exact version, CC0) to `apps/api/package.json` and the lockfile; `apps/api/src/modules/logos/brand-catalog.ts` loads all icons once (slug, title, hex, path) into a map and exposes `catalogVersion`, `get(slug)`, `search(q, limit)`; unit test `apps/api/test/unit/brand-catalog.spec.ts` (lidl found, unknown slug → undefined, search limit).
- [ ] T002 [P] Shared schemas in `packages/shared/src/schemas/logo.ts`: `logoRef` (`null` | `{ kind: 'brand', slug, title, hex, url }` | `{ kind: 'upload', url }`), `recipientLogoInput` (`{ mode: 'brand', brandSlug }` | `{ mode: 'none' }`), `brandSearchResult`; `TransactionListItem` in `cashflow.ts` gains `logo`, `logoSource` (`'auto' | 'manual' | null`), `recipientKey` (string, max 200, nullable). Export from the package index.
- [ ] T003 [P] German texts in `apps/web/i18n/locales/de.json`: `logo.change` "Logo ändern", `logo.search` "Marke suchen", `logo.auto` "Automatisch", `logo.autoDetected` "Automatisch erkannt", `logo.none` "Kein Logo", `logo.upload` "Eigenes Logo hochladen", `logo.tooBig` "Bild zu groß (max. 256 KB)", `logo.wrongType` "Nur PNG, JPEG oder WebP", `logo.appliesAll` "Gilt für alle Buchungen von {name}", `logo.licence` "Markenlogos: Simple Icons (CC0). Marken sind Eigentum ihrer Inhaber."

---

## Phase 2: Foundational

- [ ] T004 Migration `apps/api/src/database/migrations/0011_recipient_logo.sql` + `schema.ts`: table `recipient_logo` with `recipient_key` text PK ("1–200 characters"), `mode` text not null CHECK in (`brand`, `none`, `upload`), `brand_slug` text null ("required when mode = brand, else null" as CHECK), `file_name` text null ("required when mode = upload, else null" as CHECK), `updated_at` text not null default now. Unit test `apps/api/test/unit/schema-008.spec.ts` (checks reject bad combinations; upgrade from 0010 keeps bookings).
- [ ] T005 Domain `apps/api/src/domain/logo.ts` + curated aliases `apps/api/src/domain/brands.ts` (research R3 list): `recipientKey(tx)` (counterpartyKey, else `iban:<IBAN>`, else `purpose:<part after " · ", 40 chars>`), `matchBrand(text)` (normalized, whole consecutive words, longest alias first), `logoFor(tx, choice, catalog)` (upload › manual brand › none › auto › null; only types income, expense, fee, interest, tax, deposit, withdrawal). Unit test `apps/api/test/unit/logo.spec.ts`: "REWE Markt GmbH" → rewe, "PayPal (Europe) S.a.r.l. et Cie, S.C.A." → paypal, "Aldi Süd" → aldisud, "Admiral Spielhalle" and "Ottobrunn Apotheke" → none, card payment purpose "KARTENZAHLUNG · LIDL SAGT DANKE" → lidl, transfer → null, `none` suppresses auto.

---

## Phase 3: User Story 1 – See brand logos automatically (P1) 🎯 MVP

**Goal**: Logos for known merchants without any action; nothing leaves the computer.

**Independent Test**: L1, L2 in quickstart.

- [ ] T006 [US1] `apps/api/src/modules/logos/{logos.module.ts,logos.controller.ts,logos.service.ts}`: `GET /api/logos/brands/:slug.svg` (24×24, `fill="#<hex>"`, `Cache-Control: public, max-age=31536000, immutable`, unknown → 404) and `GET /api/logos/brands?q=&limit=` (1–60, default 40; empty q → curated brands first). Register in `app.module.ts`. E2E `apps/api/test/e2e/logos-brands.e2e-spec.ts` (svg content type + fill, 404, search "lid" contains lidl, auth required).
- [ ] T007 [US1] List integration in `apps/api/src/modules/transactions/transactions-review.service.ts`: load all `recipient_logo` rows once per request into a map, add `logo`, `logoSource`, `recipientKey` to every `TransactionListItem` (list and every other endpoint returning the item). E2E `apps/api/test/e2e/transaction-logo.e2e-spec.ts` (Rewe/PayPal auto, bakery null, transfer null).
- [ ] T008 [US1] `apps/web/app/components/common/MerchantLogo.vue`: props `name`, `logo`, `size` (`sm` | `md` | `lg` same sizes as `Avatar.vue`); brand/upload → round white tile with subtle border, image `object-fit: contain` (brand, ≈ 60 %) or `cover` (upload), `alt` = name, fixed size (no layout shift), `loading="lazy"`; else `Avatar`. Use it in `BookingsTable.vue` name cell, `BookingPanel.vue` header, `RuleSuggestions.vue`. Component test `apps/web/tests/merchant-logo.spec.ts`.
- [ ] T009 [US1] Playwright `e2e/us-l1-logos.spec.ts`: L1 (logos for invented "REWE Markt GmbH Test", "PayPal (Europe) Test", initials for "Bäckerei Test"; every request of the page goes to the app host), L2 (no false match), 360 px no horizontal scroll; layout-stability guard still passes.

---

## Phase 4: User Story 2 – Choose or correct the logo (P2)

**Goal**: One-click correction for all bookings of a recipient.

**Independent Test**: L3, L4 in quickstart.

- [ ] T010 [US2] API `PUT /api/logos/recipients/:key` (body `recipientLogoInput`; unknown slug → 400 "Unbekannte Marke"; key 1–200 chars) and `DELETE /api/logos/recipients/:key` (204, deletes an uploaded file) in `logos.controller.ts`/`logos.service.ts`. E2E `apps/api/test/e2e/logos-recipients.e2e-spec.ts` (brand → list shows manual brand for all bookings of the key; none → null; delete → auto again).
- [ ] T011 [US2] `apps/web/app/components/transactions/LogoPicker.vue` (`UModal`): search field (debounced `GET /api/logos/brands?q=`), grid of logo tiles with names, current marked, buttons "Automatisch", "Kein Logo", "Eigenes Logo hochladen" slot for US3, note "Gilt für alle Buchungen von …"; opened by "Logo ändern" on the panel header logo in `BookingPanel.vue`; after save refresh the table. Component test `apps/web/tests/logo-picker.spec.ts`.
- [ ] T012 [US2] Playwright `e2e/us-l2-logo-choice.spec.ts`: L3, L4 with invented recipients; reload keeps the choice; a new booking of the same recipient shows the chosen logo.

---

## Phase 5: User Story 3 – Upload an own logo (P3)

**Goal**: Fill the gaps of the brand set.

**Independent Test**: L5 in quickstart.

- [ ] T013 [US3] API `POST /api/logos/recipients/:key/upload` (multipart, field `file`, > 256 KB → 413 "Bild zu groß (max. 256 KB)", type by magic bytes PNG/JPEG/WebP else 415 "Nur PNG, JPEG oder WebP", SVG refused) storing `<uuid>.<png|jpg|webp>` in `dirname(DATABASE_PATH)/logos/` (created on demand, old file removed) and `GET /api/logos/files/:name` (name `^[0-9a-f-]{36}\.(png|jpg|webp)$` else 404, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=86400`, auth). E2E `apps/api/test/e2e/logos-upload.e2e-spec.ts` (PNG ok and served, big file 413, SVG and text 415, traversal name 404, unauthenticated 401, delete removes file).
- [ ] T014 [US3] Upload in `LogoPicker.vue` (file input accept png/jpeg/webp, client-side size check with the same German messages, preview); `MerchantLogo` shows uploads with `cover`. Extend `apps/web/tests/logo-picker.spec.ts`; Playwright `e2e/us-l3-logo-upload.spec.ts` (L5 with a generated 64×64 PNG fixture in `e2e/fixtures/`).

---

## Phase 6: Polish

- [ ] T015 [P] Licence note `logo.licence` in the Datenquellen page footer (`apps/web/app/pages/settings/sources.vue`); README section "Logos" (source, offline, uploads in the data dir).
- [ ] T016 Owner check L7 on the local dev server with real bookings: share of expense bookings (last 3 months) with logo and top-30 recipients without wrong match; fix aliases in `apps/api/src/domain/brands.ts` (only generic brand words, no private data in the repo); record the numbers in `quickstart.md`.
- [ ] T017 Full gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`); mark spec Status "Implemented".

---

## Dependencies & Execution Order

- T001 → T005, T006; T002, T003 [P] with T001.
- T004 → T007, T010.
- US1 (T006–T009) before US2 (picker needs the list fields and brand search) and US3 (upload extends the picker).
- T016 after US1 at the earliest; T017 last.

## Parallel Examples

- T002 + T003 alongside T001.
- T008 (web) alongside T006/T007 once T002 is done.

## Implementation Strategy

1. MVP: Setup + Foundational + US1 → logos appear automatically (L1, L2).
2. US2 correction picker, US3 uploads.
3. Polish T015–T017.
