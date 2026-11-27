# Tasks: Settings (014)

**Input**: Design documents from `specs/014-settings/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: included (tests per layer, Constitution IV). One commit per task; gates per commit: lint, format check, typecheck, API and web unit tests.

## Phase 1: Setup

- [X] T001 Migration `0015_*`: `account.archived_at` ("text, nullable"), table `session` ("id text PK, created_at, last_seen_at, user_agent ≤ 200 chars") in `apps/api/src/database/schema.ts`; add `fflate` (exact pin) to `apps/api/package.json`.

## Phase 2: Foundational

- [X] T002 Shared `OwnerSettings` zod schema with defaults (data-model) in `packages/shared/src/schemas/settings.ts`; `GET/PATCH /api/settings` on `user_setting` (`settings.*` JSON) in `apps/api/src/modules/settings/`; unit + API e2e (defaults, partial update, validation errors).
- [X] T003 Settings frame: `pages/settings.vue` parent with side navigation (Konten & Daten, Anzeige, Finanzen & Steuern, Sicherheit, Datenquellen, Kategorien & Regeln, Inflation, Über die App), existing pages as children, header gear opens it; `useSettings()` composable (load once, optimistic PATCH); Playwright navigation test.

## Phase 3: User Story 1 – Accounts and data (P1) 🎯 MVP

- [X] T004 [US1] Konten page: rename, hide, archive, reorder (drag + arrows) via `PATCH /api/accounts/:id` and `POST /api/accounts/order`; lists and account filter use `sort_order`, leave archived out; sums include archived only with `archivedInSums`; API e2e + component test.
- [X] T005 [US1] Daten page: demo removal card (moved from Datenquellen), CSV export of all bookings, backup download `GET /api/backup` (zip: `VACUUM INTO` snapshot, logo folder, manifest) – API e2e opens the zip and checks the snapshot.
- [X] T006 [US1] Restore: `POST /api/backup/restore` (manifest/version check, staged in `data/restore/`), applied on API start before migrations; confirmation dialog and "Neustart nötig" notice; e2e round trip (backup → change data → restore → restart helper → counts and sums equal).
- [X] T007 [US1] Automatic refresh: `refreshSchedule` setting re-plans the scheduler and calls refresh-all (013); bank consent notice from 14 days before expiry in `apps/web/app/components/import/BankConsentNotice.vue`; unit test for next-run computation, component test for the notice.

## Phase 4: User Story 2 – Display (P2)

- [X] T008 [US2] Anzeige page: start page (redirect from `/` when not dashboard), default chart period (PeriodTabs initial value), colour mode (server value applied on load), density (root class, compact table padding); Playwright for start page and density.
- [X] T009 [US2] Privacy mode: `Money`/`Percent` and chart axes masked, header eye toggle, setting persisted; component test + Playwright (no amount visible on dashboard when on).

## Phase 5: User Story 3 – Finances and taxes (P2)

- [X] T010 [US3] Finanzen & Steuern page and domain: assessment default for new tax years, church tax (8 % BY/BW, 9 % else) as estimated tax on the Vorabpauschale, `purchasesCountAsSaved` in cash flow, display rounding; unit tests per rule, API e2e.
- [ ] T011 [US3] Budget month start (1–28): period domain shifts month/quarter/year for cash flow, Sankey and budgets; labels show the range; unit tests (25.10.–24.11.), API e2e, consistency e2e (013) still green.

## Phase 6: User Story 4 – Security and about (P3)

- [ ] T012 [US4] Sessions: login creates a `session` row, guard checks/touches it (≤ once a minute), idle logout after `autoLogoutMinutes`, `GET/DELETE /api/auth/sessions`; API e2e (second session listed and ended, idle expiry with fake clock).
- [ ] T013 [US4] Sicherheit page: change password (`POST /api/auth/password`, current required, other sessions ended), sessions list with "Überall abmelden", auto logout select; also update the local dev login note in the README; component test + API e2e.
- [ ] T014 [US4] Über die App: `GET /api/about` (version, database size, sources from the 013 state) and page; API e2e.

## Phase 7: Polish

- [ ] T015 Layout guard (settings pages added to `e2e/pages.ts`), hydration, dark/light; owner check Q1–Q7; status in `quickstart.md`.
- [ ] T016 Full gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), reading the e2e log; mark spec Status "Implemented".

## Dependencies

- T001 → T002 → T003 → all stories. T005 → T006. T012 → T013. T015, T016 last. US2, US3, US4 independent of each other after T003.

## Parallel Opportunities

- After T003: US1, US2, US3 and US4 touch different files and can run in parallel.

## Implementation Strategy

1. MVP: Setup + Foundational + US1 (accounts, data, backup, refresh).
2. US2, US3, US4.
3. Polish.
