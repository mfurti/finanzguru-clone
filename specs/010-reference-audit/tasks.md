# Tasks: Figures, Calculations and Layout Checked Against the Reference

**Input**: Design documents from `specs/010-reference-audit/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included (Constitution IV): domain unit per rule, API e2e, component tests, Playwright per story and a layout guard.

**Standards**: plan.md › Coding Standards. Gates before each commit: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, API and web unit tests.

**Commits**: One commit per task, pushed immediately; issue checklist synced. No deployment tasks. Owner amounts never committed.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 Owner audit script `apps/api/src/scripts/audit-figures.ts` (+ `audit:figures` script in `apps/api/package.json`): prints the app's figures of spec section A for given account ids (net worth, gain, Kennzahlen 1 J, positions, current-month cash flow, categories, unreviewed count) as a table; writes nothing into the repository. Unit-free; smoke-tested against the e2e demo database.

---

## Phase 2: Foundational

- [X] T002 Resolve research R1, R2, R3, R6 (reference UI read only, owner trades locally): decide FIFO vs. average cost, period Kursgewinn base, lot matching for realized gains, where trade taxes/fees live, value rule on gap days, unreviewed counting, the 100 € month difference; update `research.md` (definitions only) and, if needed, add follow-up tasks for missing data fields here before implementation continues.

---

## Phase 3: User Story 1 – Same figures as the reference (P1) 🎯 MVP

**Independent Test**: Q1, Q2 in quickstart.

- [X] T003 [US1] Valuation consistency (FR-001) and gap days (FR-005) in `apps/api/src/domain/snapshots.ts` / `instrument-values.ts` and `overview.service.ts`: chart total = allocation total; no artificial drop between sell and re-buy or on missing quotes. Unit tests with invented fixtures (sell day, re-buy two days later, missing quote).
- [X] T004 [US1] Cost basis, Einstiegswert, Investiertes Kapital and Kursgewinn per R1 in `apps/api/src/domain/positions.ts` and `period-returns.ts`; positions and Kennzahlen use them. Unit tests where FIFO and average differ; API e2e for `/api/investments/positions` and `/api/overview/kpis`.
- [X] T005 [US1] Realized gains brutto/netto and Steuern & Gebühren per R2 in `positions.ts` / `portfolio.service.ts`. Unit tests with partial sells, fees and taxes.
- [X] T006 [US1] Gesamtertrag, TWROR, IZF, Realrendite (FR-004) from the corrected inputs in `returns.ts` / `portfolio.service.ts`; Realrendite null when the reference shows none; ⓘ texts updated in `de.json`. Unit tests.
- [ ] T007 [US1] "Sparen und Anlegen" as expense and Gespart, Saldo and Sparquote = Gespart ÷ Einnahmen (FR-006, R4) in `apps/api/src/domain/cashflow.ts`; ⓘ texts. Unit tests and e2e for `/api/cashflow/summary`.
- [ ] T008 [US1] Unreviewed count and monthly bar rules per R6 (FR-008); fix or document the remaining difference in `quickstart.md`. Tests for the chosen rule.
- [ ] T009 [US1] Owner check Q1/Q2 with the audit script and the reference (read only); real values only in `apps/api/data/audit-010-local.md`; status (matched / explained) in `quickstart.md`.

---

## Phase 4: User Story 2 – Fewer uncategorized bookings (P2)

**Independent Test**: Q3 in quickstart.

- [ ] T010 [US2] Extend built-in default rules (generic merchant words → reference categories: marketplaces, payment providers, streaming, telecom, supermarkets, drugstores, fuel, public transport) in `apps/api/src/domain/categorize.ts` / seed; owner rules and manual categories keep priority; data migration only if T002 decided so. Unit tests per merchant group.
- [ ] T011 [US2] Apply the defaults to existing uncategorized bookings (one-time on start or via "Regeln anwenden"), never overwriting manual or owner-rule categories; e2e test; owner check Q3 recorded.

---

## Phase 5: User Story 3 – Tables that fit (P2)

**Independent Test**: Q4, Q5 in quickstart.

- [ ] T012 [US3] Phone booking list `apps/web/app/components/transactions/BookingList.vue` used by `BookingsTable.vue` below 640 px: date-grouped rows (checkbox, logo, name, category, signed amount), row click opens the side panel, toolbar actions in a ⋮ menu. Component test.
- [ ] T013 [US3] Tablet columns in `BookingsTable.vue` (640–1023 px): Name, Datum short ("24.11.26"), Kategorie, Betrag; measured fit at 768 px. Component test.
- [ ] T014 [US3] `PositionsTable.vue` fits at 1440 px (default columns like the reference: Name, Aktueller Kurs, Aktueller Wert, Einstiegswert, Kursgewinn, Allokation, Dividende) and has a sticky first column; investment bookings and taxes tables sticky first column. Component tests.
- [ ] T015 [US3] Playwright layout guard `e2e/layout-guard.spec.ts`: all 15 pages at 375/768/1440 px – no page overflow, booking amount visible, tables fit at 1440 px, sticky first column where a table scrolls.

---

## Phase 6: User Story 4 – One look for controls and figure boxes (P3)

**Independent Test**: Q6 in quickstart.

- [ ] T016 [P] [US4] One control size: `apps/web/app/app.config.ts` defaults (`select`, `selectMenu`, `input`, toolbar buttons) and removal of explicit `size="xs|sm"` on dropdown triggers; layout guard extended (one trigger height per page).
- [ ] T017 [P] [US4] Figure boxes in `apps/web/app/components/budget/SummaryTiles.vue`: visible border in both themes, darker surface, Gespart/Sparquote as label-left/value-right rows with ⓘ, five-in-a-row variant on Budget › Analyse from 1280 px; component test `apps/web/tests/summary-tiles.spec.ts`.

---

## Phase 7: Polish

- [ ] T018 Owner check SC-001–SC-004 at 375/768/1440 px, dark and light; status in `quickstart.md` (no amounts).
- [ ] T019 Full gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`), reading the e2e log for failures; mark spec Status "Implemented".

---

## Dependencies & Execution Order

- T001 → T002 → US1 (T003 → T004 → T005 → T006; T007, T008 after T002) → T009.
- US2 (T010 → T011) after T002; independent of US1.
- US3 (T012–T015) and US4 (T016, T017) independent of US1/US2; T015 after T012–T014.
- T018, T019 last.

## Parallel Examples

- T016 + T017 alongside US1 work; T012 + T014 in parallel.

## Implementation Strategy

1. MVP: T001–T009 → figures match the reference.
2. US2 categories, US3 tables, US4 look.
3. Polish T018–T019.
