# Tasks: Popups, Tables and Charts Like the Reference

**Input**: Design documents from `specs/007-popup-chart-parity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included (Constitution IV): API e2e, component tests, one Playwright journey per story.

**Standards**: plan.md › Coding Standards. Gates before each commit: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, API unit tests.

**Origin**: Side-by-side comparison with the reference app on 2026-11-25 at 1440 px; owner reports: category window too small, amount missing in Transaktionen.

**Commits**: One commit per task, pushed immediately; issue checklist synced. No deployment tasks.

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 [P] Shared DTOs in `packages/shared/src/schemas/transaction.ts` and the list item in `cashflow.ts` (`note`, plus `institutionName` and `counterpartyIban` for the side panel; committed together with T003 because the API must return them to compile): `updateTransactionInput.note` ("max 1 000 characters", trimmed, `''` → null); filter `direction` (`in` | `out`) in the list, export and bulk filter schemas.
- [X] T002 [P] German texts in `apps/web/i18n/locales/de.json`: side panel (Konto, Details, An, IBAN, Verwendungszweck, Betrag, Datum, Transaktionstyp, "Als ungeprüft markieren", "Als Kontentransfer markieren", Tags, Notizen, "Notiz hinzufügen", "Transaktion löschen"), category window ("Kategorie ändern", "Kategorie suchen", "Alle Kategorien", "Eigene Kategorien", "Neue Kategorie erstellen"), filter (Konten, "Art der Transaktion", Zeitraum, Kontobewegungen, "Ein- und ausgehende", Eingehende, Ausgehende, "Min Betrag", "Max Betrag", "Ergebnisse anzeigen"), info texts for Gesamtvermögen and Gewinn, add window ("Was möchtest du hinzufügen?", Anbieter, Assets, "Anbieter, IBAN oder BIC eingeben", "Beliebte Anbieter", "Anbieter manuell hinzufügen", "Wie möchtest du importieren?", Automatisch, "Datei hochladen", Manuell), "Gesamtausgaben", "Gesamteinnahmen".

---

## Phase 2: Foundational

- [X] T003 Migration `apps/api/src/database/migrations/0010_transaction_note.sql` + `schema.ts`: `transaction.note` text nullable with check "length(note) <= 1000". API: list returns `note`; PATCH saves it (trim, `''` → null, > 1 000 → 400) in `transactions-review.service.ts`; list/export/bulk filter `direction` (`in` → `amount_cents > 0`, `out` → `< 0`, other → 400). Tests: `apps/api/test/unit/schema-007.spec.ts` (incl. upgrade from 0009 keeping bookings and tags) and `apps/api/test/e2e/transaction-note-direction.e2e-spec.ts`. The CHECK makes drizzle-kit rebuild `transactions`; its generated copy statement wrongly selected `note` from the old table and was corrected by hand.

---

## Phase 3: User Story 1 – Work through bookings like in the reference (P1) 🎯 MVP

**Goal**: Betrag always visible; booking side panel; one large category window.

**Independent Test**: W1–W3 in quickstart.

- [X] T004 [US1] `apps/web/app/components/transactions/BookingsTable.vue` (research R1): default visible columns Name, Datum, Kategorie, Eigenschaften, Betrag; Konto and Verwendungszweck optional (off; stored choices with Konto keep it); name cell truncates with `title`, purpose line only when the Verwendungszweck column is off and the window is ≥ 1280 px; Betrag right-aligned, `whitespace-nowrap`. Below 1280 px Eigenschaften give way and names narrow to fit 1024 px (measured: table = box at 1024/1280/1440 px). Default logic in `apps/web/app/utils/booking-columns.ts`. Component test `apps/web/tests/bookings-columns.spec.ts`; Playwright check in T008 at 1024/1280/1440 px that the table is not wider than its box.
- [X] T005 [P] [US1] `apps/web/app/components/transactions/CategoryWindow.vue` (research R2): `UModal` ~640 px, search, tabs Alle/Eigene, collapsible main categories with `CategoryIcon`, sub-category rows, current marked, "Neue Kategorie erstellen" inline (POST `/api/categories`), the 006 options below (scope, merken, `RuleFields`), one "Speichern" (PATCH or bulk like 006). Replace the chip `USelectMenu` and the bulk select in `BulkBar.vue`; delete `CategoryChangeDialog.vue` and move its test cases into `apps/web/tests/category-window.spec.ts`.
- [X] T006 [US1] `apps/web/app/components/transactions/BookingPanel.vue` (research R3): `USlideover` right (full screen < 640 px) opened by row click (checkbox, chip, delete stop propagation): avatar, name, signed amount, date; account + institution; category (opens `CategoryWindow`); An, IBAN, Verwendungszweck; Betrag; Datum; Transaktionstyp select; switches "Als ungeprüft markieren" (reviewStatus) and "Als Kontentransfer markieren" (type `transfer`); tags (existing tag picker); note textarea (saves on blur, PATCH `note`); "Transaktion löschen" (existing delete with undo). Component test `apps/web/tests/booking-panel.spec.ts`.
- [X] T007 [US1] Update older Playwright journeys that use the chip dropdown or the 006 dialog (`e2e/us-p1-transactions.spec.ts`, `e2e/us5-budget.spec.ts`, `e2e/us-r1-category-rules.spec.ts`, `e2e/us-r2-rule-suggestions.spec.ts`) to the category window.
- [X] T008 [US1] Playwright `e2e/us-u1-bookings.spec.ts`: Betrag visible at 1024/1280/1440 px (table width ≤ box width), side panel fields and note saved, category window search + merken; 360 px.

---

## Phase 4: User Story 2 – Filter in a side panel (P2)

- [ ] T009 [US2] `apps/web/app/components/transactions/BookingFilterPanel.vue` as `USlideover`: Konten, Art der Transaktion, Zeitraum (`DateRangePicker`), Kategorie, Tags, Kontobewegungen (alle / eingehend / ausgehend → `direction`), Min/Max Betrag, Status; "Zurücksetzen", "Ergebnisse anzeigen"; badge with active-filter count; URL sync of `direction`. Component test `apps/web/tests/booking-filter.spec.ts`.
- [ ] T010 [US2] Playwright `e2e/us-u2-filter.spec.ts`: ausgehend + 10–100 € → only matching rows, badge "2"; 360 px.

---

## Phase 5: User Story 3 – Dashboard like the reference (P2)

- [ ] T011 [P] [US3] `apps/web/app/components/dashboard/NetWorthChart.vue` (research R6): one header row (tabs left; periods, calendar, menu right; wraps on phones), ⓘ at Gesamtvermögen and Gewinn via `InfoTooltip`, line without area, compact axis formatter `apps/web/app/utils/compact-eur.ts` ("5K €", "1,2M €") with unit test `apps/web/tests/compact-eur.spec.ts`; "Vergleichen mit" right of the headline.
- [ ] T012 [P] [US3] `apps/web/app/components/dashboard/CardTitle.vue` (title + "›" link + optional ⋮ menu) and use it in `AllocationCard`, `AccountsCard`, `HoldingsCard`, `CashflowCard`, `BudgetsCard`; Aufteilung €/% below right of the donut; Holdings Top/Flop side by side ≥ 768 px; `ReviewBanner.vue` as one-line tile (dot, count, "Ungeprüfte Transaktionen", "Alle anzeigen"); `KpiCard.vue` TWROR/IZF/Inflation/Realrendite as 2-column grid with value right. Component test `apps/web/tests/dashboard-cards.spec.ts`.
- [ ] T013 [US3] `apps/web/app/pages/index.vue` (research R5): two fixed columns ≥ 1024 px (left allocation, kpis, holdings; right accounts, review, cashflow, budgets; networth on top), order and visibility within a column from `dashboard_layout`; one column below. Playwright `e2e/us-u3-dashboard.spec.ts` checks order and header row at 1440 px and stacking at 360 px.

---

## Phase 6: User Story 4 – Cash-flow charts like the reference (P3)

- [ ] T014 [P] [US4] Shared month-axis labels `apps/web/app/utils/month-axis.ts` (month line, year line only at January or the first bar, divider at year change) with unit test; use in `CashflowCard.vue` and `apps/web/app/pages/budget/index.vue`; figures Einnahmen/Ausgaben/Saldo in a bordered 3-column grid and Gespart/Sparquote in their own box in both places.
- [ ] T015 [US4] Budget › Analyse: Sankey card (existing Sankey component, €/% switch, link "Zur Sankey-Ansicht") between chart and categories in `apps/web/app/pages/budget/index.vue`; `DonutChart.vue` without gaps and centre label "Gesamtausgaben"/"Gesamteinnahmen". Component test `apps/web/tests/budget-analyse.spec.ts`; Playwright `e2e/us-u4-cashflow.spec.ts`.

---

## Phase 7: User Story 5 – Add something from one large window (P3)

- [ ] T016 [US5] `apps/web/app/components/common/AddWindow.vue` replacing `AddMenu.vue` (research R7): tabs Anbieter/Assets, search (name, IBAN, BIC), supported providers with import methods, "Anbieter manuell hinzufügen", step "Wie möchtest du importieren?" linking to existing flows; Assets tab: Konto anlegen, Transaktion erfassen, Wertpapier suchen. Component test `apps/web/tests/add-window.spec.ts`; update `apps/web/tests/add-menu.spec.ts` callers; Playwright `e2e/us-u5-add.spec.ts`.

---

## Phase 8: Polish

- [ ] T017 Side-by-side check W8 with the reference on the local dev server (8 places, 1440 px and 360 px, dark/light); record differences left (if any) in `quickstart.md`.
- [ ] T018 Full gates (`pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`); mark spec Status "Implemented".

---

## Dependencies & Execution Order

- T001, T002 [P] → T003 → stories.
- US1: T004, T005 [P] in parallel; T006 after T005 (opens the window); T007 after T005; T008 last.
- US2 needs T003 (`direction`); independent of US1 except shared `BookingsTable` URL sync (do after T004).
- US3, US4, US5 independent of each other and of US1/US2.
- Polish after all stories.

## Parallel Examples

- T004 + T005; T011 + T012 + T014; T016 alongside US3/US4.

## Implementation Strategy

1. MVP: Setup + Foundational + US1 (amount visible, side panel, category window) → W1–W3.
2. US2 filter, US3 dashboard, US4 charts, US5 add window.
3. Polish T017–T018.
