# Tasks: Trustworthy Figures, Refresh and Data Timestamp (013)

**Input**: Design documents from `specs/013-trust-and-refresh/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: included (tests per layer, Constitution IV). One commit per task; gates per commit: lint, format check, typecheck, API and web unit tests.

## Phase 1: Setup

- [X] T001 Migration `0013_*`: `institution.is_demo` ("integer boolean, default 0"), `account.source_balance_cents` ("integer, nullable"), `account.source_balance_date` ("text ISO date, nullable"); mark the seeded "Demo Broker"/"Demo Bank" institutions; demo seed sets `is_demo` in `apps/api/src/database/demo.ts`; schema in `apps/api/src/database/schema.ts`.

## Phase 2: User Story 1 – Figures the owner can rely on (P1) 🎯 MVP

**Goal**: R5. **Independent test**: quickstart Q1–Q3.

- [X] T002 [US1] Demo removal: domain selection + `DELETE /api/demo` (one transaction, dependency order, shared instruments kept) in `apps/api/src/modules/demo/`; API e2e `demo-removal.e2e-spec.ts` (demo gone, an own account with bookings untouched, sums = own data only).
- [X] T003 [US1] Confirmed "Demo-Daten entfernen" button on `apps/web/app/pages/settings/sources.vue` (shown only while demo data exists), refreshes all data afterwards; component test.
- [X] T004 [US1] Consistency e2e `apps/api/test/e2e/consistency.e2e-spec.ts`: net worth = allocation = Σ accounts overview; Sankey income/expenses = cash-flow summary; Σ categories = Ausgaben gesamt; for 3 periods × (all, one depot, one giro) selections; fix any mismatch found.
- [X] T005 [US1] Balance check: bank and broker sync store source balance + date; `GET /api/accounts` returns `balanceCheck`; warning in account rows/detail (`apps/web/app/components/accounts/*`); unit test for the comparison, API e2e, component test.
- [ ] T006 [US1] Owner re-audit after demo removal (local, git-ignored `apps/api/data/audit-013-local.md`): A2/A4, A5, A18; fix derivable rules with fixture tests, otherwise ⓘ texts in `apps/web/i18n/locales/de.json` stating the definition; status (no amounts) in `quickstart.md`.

## Phase 3: User Story 2 – Refresh and data state (P2)

**Goal**: R3, R4. **Independent test**: quickstart Q4.

- [ ] T007 [US2] `POST /api/sources/refresh-all` and `GET /api/sources/state` in `apps/api/src/modules/sources/` (sequential, result per source, oldest success, outdated after 24 h); API e2e with mocked connections.
- [ ] T008 [US2] Übersicht frame (`apps/web/app/layouts/overview.vue`): "Aktualisieren" left of "Anpassen" (spinner, toast per source, refresh data), "Stand: TT.MM.JJJJ, HH:MM" with per-source tooltip and outdated highlight; disabled with hint when no source; component test + Playwright.

## Phase 4: User Story 3 – Charts (P3)

**Goal**: R1, R2. **Independent test**: quickstart Q5.

- [ ] T009 [P] [US3] Crosshair/tooltip without transition in all charts with a hover line (`NetWorthChart`, `PerformanceChart`, `CashflowBars`, `DividendHistory`, `CompareChart`, `ReturnViews`, `AccountDetail`, instrument page); Playwright check that the line moves within one frame.
- [ ] T010 [P] [US3] Remove the dashboard card hover (`card-hover`) in `apps/web/app/pages/index.vue` and the utility if unused (`apps/web/app/assets/css/main.css`); Playwright check that a card keeps its background on hover.

## Phase 5: Polish

- [ ] T011 Layout guard, hydration, Sankey hover green at 375/768/1440; owner check Q1–Q5 dark and light; status in `quickstart.md`.
- [ ] T012 Full gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), reading the e2e log for failures; mark spec Status "Implemented".

## Dependencies

- T001 → T002 → T003; T001 → T005. T004 after T002 (uses data without demo noise as well as the demo set). T006 after T002, T004, T005. T007 → T008. T009, T010 independent. T011, T012 last.

## Parallel Opportunities

- T009, T010 [P] alongside US1/US2.

## Implementation Strategy

1. MVP: US1 (demo removal, consistency, balance check, re-audit).
2. US2 refresh + state.
3. US3 charts, then polish.
