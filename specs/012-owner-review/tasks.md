# Tasks: Owner Review Round (012)

**Input**: Design documents from `specs/012-owner-review/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: included (tests per layer, Constitution IV). One commit per task; gates per commit: lint, format check, typecheck, API and web unit tests.

## Phase 1: Setup

- [X] T001 Local dividend audit: extend `apps/api/src/scripts/audit-figures.ts` with dividends per year for `--accounts` and record the owner's comparison in git-ignored `apps/api/data/audit-012-local.md`; write the anonymized cause into `specs/012-owner-review/research.md` R4.

## Phase 2: User Story 1 – Navigation and tables (P1)

**Goal**: P1–P5, P15. **Independent test**: quickstart Q1–Q3.

- [X] T002 [US1] Übersicht frame: parent route with `SectionNav` once and `<NuxtPage>` for Dashboard, Portfolios & Konten, Transaktionen (URLs unchanged) in `apps/web/app/pages/`; Playwright test that the nav element stays mounted when switching (`e2e/overview-nav.spec.ts`).
- [X] T003 [P] [US1] Labels "Buchungen" (Investments nav, page title) and "Watchlist" in `apps/web/i18n/locales/de.json` and the investments nav; update affected tests.
- [X] T004 [US1] Booking columns (R2): chooser Datum, Kategorie, Tags, Eigenschaften (icons), Betrag, Steuern; stored-choice migration in `apps/web/app/utils/booking-columns.ts`; `BookingsTable.vue` columns; unit test for the migration, component test for the chooser.
- [X] T005 [US1] `ColumnsPanel.vue` slideover (select all, checkbox rows, drag + move buttons, Speichern) and Positionen columns incl. Realisiert € and Transaktionen, stored order/visibility (`vk.positions.columns`) in `apps/web/app/components/investments/PositionsTable.vue`; component test.
- [X] T006 [P] [US1] `ArtBadge.vue` (Kauf green, Verkauf blue, others neutral) above the date in `apps/web/app/components/investments/TransactionsTable.vue` (table and phone cards); component test.
- [X] T007 [P] [US1] Account filter in Investments lists only depot accounts (`apps/web/app/components/common/AccountFilter.vue` by route section); component test.

## Phase 3: User Story 2 – Dividends and taxes (P1)

**Goal**: P6–P9. **Independent test**: quickstart Q4–Q5.

- [ ] T008 [US2] Fix the dividend yearly figures per R4 in `apps/api/src/domain/` / `modules/investments` with fixture unit tests encoding the rule (no owner amounts).
- [ ] T009 [US2] Dividend summary `portfolioValueCents`, `yearCents`, `byCurrency` (shared schema, API, unit + e2e test).
- [ ] T010 [US2] Dividenden page: three cards (Investments, Dividendenerträge, Dividendenrendite) and Aufteilung tab Währungen in `apps/web/app/pages/investments/dividends.vue`, `components/dividends/*`; component tests.
- [ ] T011 [US2] Exemption providers: `GET /api/taxes/exemption-providers` (domain used-per-institution + e2e) and provider rows with inline edit in the Freistellungsaufträge card (`apps/web/app/components/taxes/*`); component test.

## Phase 4: User Story 3 – Sankey and donut (P2)

**Goal**: P11, P12. **Independent test**: quickstart Q6.

- [ ] T012 [US3] Sankey order without upward flows (R7): mains with subs first, mains without subs then balance at the bottom, invisible filler subs in `apps/web/app/utils/sankey-order.ts` / `sankey-option.ts` (filler hidden from labels, tooltip, block list); unit tests (order, filler, no sub above its main).
- [ ] T013 [US3] Responsive donut (R8) in `apps/web/app/components/common/DonutChart.vue`, used by `CategoryDonut.vue`; component test.

## Phase 5: User Story 4 – Watchlist, budgets, insurance (P3)

**Goal**: P10, P13, P14. **Independent test**: quickstart Q7.

- [ ] T014 [US4] Watchlist like the reference (R9): tabs, default watchlist, header with count, period switch, Hinzufügen, ⋮ rename/delete, empty state in `apps/web/app/pages/investments/watchlists/*`; API default creation if needed; tests.
- [ ] T015 [US4] Budgets empty state as one card (R10) and table columns in `apps/web/app/pages/budget/budgets.vue`; component test.
- [ ] T016 [US4] Insurance suggestions (R11): migration for `insurance_suggestion_dismissal` ("key text PK 1–200 chars, dismissed_at not null"), domain detection with unit tests, endpoints + e2e, UI list with accept/dismiss in `apps/web/app/pages/insurance/*`.

## Phase 6: Polish

- [ ] T017 Layout guard, hydration and Sankey hover e2e at 375/768/1440 green; fix regressions.
- [ ] T018 Owner check Q1–Q8 in dark and light; status (no amounts) in `specs/012-owner-review/quickstart.md`.
- [ ] T019 Full gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), reading the e2e log for failures; mark spec Status "Implemented".

## Dependencies

- T001 before T008. T009 before T010. T002–T007 independent of each other except T003 after T002 (same nav). T012, T013 independent. T014–T016 independent. T017–T019 last.

## Parallel Opportunities

- T003, T006, T007 [P]; US3 and US4 can run alongside US2.

## Implementation Strategy

1. MVP: US1 (navigation, columns, badges, filter).
2. US2 (dividends, taxes) – figures first.
3. US3, US4, Polish.
