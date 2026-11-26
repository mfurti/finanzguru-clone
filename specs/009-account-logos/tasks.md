# Tasks: Logos for Banks, Brokers, Portfolios and Accounts

**Input**: Design documents from `specs/009-account-logos/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included (Constitution IV): unit, API e2e, component tests, one Playwright journey per story.

**Standards**: plan.md › Coding Standards. Gates before each commit: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, API and web unit tests.

**Commits**: One commit per task, pushed immediately; issue checklist synced. No deployment tasks.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 [P] Shared: `AccountDto` in `packages/shared/src/schemas/account.ts` gains `logo` (LogoRef), `logoSource`, `logoKey` ("`institution:<institutionId>`; null for institution Manuell"); API `accounts.service.ts` returns them as null until T005 so the build stays green.
- [X] T002 [P] German texts in `apps/web/i18n/locales/de.json`: `logo.institutionAppliesAll` "Gilt für alle Konten von {name}", `logo.localHint` (README pointer for the local folder).

---

## Phase 2: Foundational

- [ ] T003 Local set loader `apps/api/src/modules/logos/local-brands.ts`: folder `BRAND_LOGOS_DIR` (env schema, optional) else `dirname(DATABASE_PATH)/brand-logos`; reads `brands.json` (`key` "`^[a-z0-9-]{1,60}$`", `title` "1–60 characters", `words` "1–10 entries, each 1–60 characters", `file` "`^[a-zA-Z0-9._-]{1,80}$`"), files PNG/JPEG/WebP by magic bytes or SVG passing `isSafeSvgBody`, "≤ 256 KB"; skips invalid entries with one warning each; missing folder → empty set. `brand-catalog.ts` registers set `local` (keys `local:<key>`, listed first in search); `domain/logo.ts` takes the local words as aliases ahead of built-in aliases of the same word count. Ensure `.gitignore` covers the folder (it is inside `apps/api/data/`) and the commit helper's leak guard refuses staged files under `brand-logos/`. Unit `apps/api/test/unit/local-brands.spec.ts` with generated fixtures in a temp dir (valid PNG, valid SVG, 300 KB file, SVG with script, bad JSON entry, missing folder, priority over built-in).

---

## Phase 3: User Story 1 – Bank and broker logos automatically (P1) 🎯 MVP

**Independent Test**: A1 in quickstart.

- [ ] T004 [US1] Route `GET /api/logos/brands/local/:key` in `logos.controller.ts` (content type by file, `Cache-Control: private, max-age=86400`, `nosniff`, 008 CSP for SVG, unknown → 404); brand URLs for local brands point there. E2E in `apps/api/test/e2e/logos-local.e2e-spec.ts` with `BRAND_LOGOS_DIR` set to a temp fixture folder.
- [ ] T005 [US1] `accounts.service.ts` list: logo via `LogosService` (`logoFor` with institution name as counterparty text, choice from `recipient_logo` key `institution:<institutionId>`, no logo for "Manuell"). E2E `apps/api/test/e2e/account-logos.e2e-spec.ts` (Sparkasse/Klarna logo, Manuell null, unknown institution null, local brand wins).
- [ ] T006 [US1] Web composable `apps/web/app/composables/useAccountLogos.ts` (`byAccount(id)`, `byInstitution(name)`, shares `key: 'accounts'`); `MerchantLogo` in `AccountsCard.vue`, `AccountRow.vue`, `AccountDetail.vue`, `AccountFilter.vue` (small), `BookingPanel.vue` (account line), `BankCard.vue`, `ScalableCard.vue`. Component test `apps/web/tests/account-logos.spec.ts`.
- [ ] T007 [US1] Playwright `e2e/us-a1-account-logos.spec.ts`: logos on overview card, Konten, detail, filter; Manuell initials; only same-origin requests; 360 px.

---

## Phase 4: User Story 2 – Local logo folder (P2)

**Independent Test**: A2, A3 in quickstart.

- [ ] T008 [US2] Local brands as merchant logos too (bookings, picker search first) – verify via e2e `apps/api/test/e2e/logos-local.e2e-spec.ts` (booking "Scalable Capital Bank GmbH" → `local:scalable-capital`); README section "Eigene Logos (lokal)" with `brands.json` example, folder location, `BRAND_LOGOS_DIR`, licence note (official logos only locally, never committed).
- [ ] T009 [US2] Playwright `e2e/us-a2-local-logos.spec.ts`: e2e web server started with `BRAND_LOGOS_DIR` pointing to generated fixtures (`e2e/fixtures/brand-logos/` with an invented brand only), logo shown for account and booking.

---

## Phase 5: User Story 3 – Choose the logo of an institution (P3)

**Independent Test**: A4 in quickstart.

- [ ] T010 [US3] `AccountDetail.vue`: clicking the logo opens `LogoPicker` with `recipient-key` = `logoKey`, note "Gilt für alle Konten von …"; after save refresh accounts. Component test extended; Playwright `e2e/us-a3-institution-logo.spec.ts` (Kein Logo, Automatisch, upload of the 008 PNG fixture).

---

## Phase 6: Polish

- [ ] T011 Owner step A6: fill the local folder for the owner's institutions (helper session downloads only with the owner's OK per file; files stay in the git-ignored folder); record coverage numbers (no names of private persons) in `quickstart.md`.
- [ ] T012 Full gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`); mark spec Status "Implemented".

---

## Dependencies & Execution Order

- T001, T002 [P] → T003 → T004 → T005 → T006 → T007.
- US2 (T008, T009) after T005; US3 (T010) after T006.
- T011 after T008; T012 last.

## Implementation Strategy

1. MVP: Setup + Foundational + US1 → built-in bank logos on all account places (A1).
2. US2 local folder, US3 choice.
3. Polish T011–T012.
