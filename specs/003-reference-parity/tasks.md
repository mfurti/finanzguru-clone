# Tasks: Reference Parity (Vermögenskompass ↔ Finanzfluss Copilot)

**Input**: Design documents from `specs/003-reference-parity/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included. Every layer gets tests, as research R14 requires: domain unit tests, API e2e tests, component tests, and one Playwright journey per story.

**Commits**: One commit per task, pushed immediately. The issue checklist is synced after each task.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: The task can run in parallel. It touches different files and has no open dependencies.
- **[Story]**: The task belongs to that user story (US1–US8 from spec.md).

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 [P] Add `CATEGORY_ICONS` to `packages/shared/src/category-icons.ts` and export it from `packages/shared/src/index.ts`.
  - About 40 Lucide keys, each with a German label. Include `tag` (default), `house`, `shopping-cart`, `utensils`, `car`, `bus`, `plane`, `heart-pulse`, `shield`, `piggy-bank`, `gift`, `shirt`, `graduation-cap`, `baby`, `dog`, `dumbbell`, `film`, `music`, `phone`, `wifi`, `zap`, `droplet`, `flame`, `briefcase`, `banknote`, `landmark`, `receipt`, `coffee`, `beer`, `book`, `gamepad-2`, `wrench`, `sofa`, `scissors`, `pill`, `train-front`, `fuel`, `hand-coins` and `trending-up`.
  - Add `isCategoryIcon(key)`.
- [X] T002 [P] Add zod DTOs exactly as in `specs/003-reference-parity/contracts/http-api.md` to `packages/shared/src/schemas/` (the repo keeps DTOs there), new files per area or extending the existing ones, and export them all:
  - `transaction.ts`: filter and list query (`pageSize` 1–200, UI offers 25/50/100), `sort` whitelist `date|amount|counterparty|category|account`, `dir` ∈ {asc, desc}, `review` ∈ {all, unreviewed, reviewed}.
  - `transactions-bulk.ts`: `ids` (1–1000) XOR `filter`.
  - `tags.ts`: name 1–40, trimmed.
  - `search.ts`: `q` 2–100, trimmed.
  - `accounts-overview.ts`.
  - `budgets-overview.ts`.
  - `category-detail.ts`.
  - Extend `TransactionRow` with `tags`, `categoryIcon`, `categoryColor` and `accountName`.
- [X] T003 [P] Add German i18n keys to `apps/web/i18n/locales/de.json` for all new texts. Examples: "Nur ungeprüfte anzeigen", "Alle als geprüft markieren", "Alle auswählen", "Filtern", "Spalten", "Tags", "Export", "Rückgängig", "Letzter Import", "Aktualisieren", "Aktueller Monat", "Budgethöhe", "Ausgaben", "Status", "Differenz", "Gesamtbudget", "Zeiträume", "Jahre", "Regionen", "Branchen", "Keine Treffer", "Suchen …".
- [X] T004 [P] Add the Outfit font and use it everywhere:
  - Bundle the Outfit variable font from the npm package `@fontsource-variable/outfit` (OFL-1.1, latin and latin-ext, `font-display: swap`) via `@import` in `apps/web/app/assets/css/main.css`; Vite serves the woff2 files from the app origin.
  - Set `--font-sans: 'Outfit Variable', 'Outfit', Arial, sans-serif` and turn off the Nuxt UI font provider (`ui: { fonts: false }`) so no font is fetched from a third party (research R11).

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Extend `apps/api/src/database/schema.ts` as specified in data-model.md:
  - Index `transactions_booking_id_idx` on `(booking_date, id)`.
  - `category.icon` (text, not null, default `'tag'`).
  - New table `tag`: `name` 1–40 chars, unique via a `lower(name)` unique index; `color` default `neutral`; `created_at`.
  - New table `transaction_tag`: PK `(transaction_id, tag_id)`, both FKs on delete cascade, index on `tag_id`.
  - New table `deleted_import_marker`: `source`, `fingerprint` not null, `source_ref` nullable, `deleted_at`; unique `(source, fingerprint)`.
- [X] T006 Generate `apps/api/src/database/migrations/0006_reference_parity.sql` with `pnpm --filter api db:generate`.
  - Hand-check that it uses only `CREATE TABLE`, `CREATE INDEX` and `ALTER TABLE ADD`, with no table rebuild.
  - Run it against a copy of the dev DB.
  - Extend the migration smoke check in `apps/api/test/e2e/`.
- [X] T007 Add the undo store `apps/api/src/modules/transactions/transactions-trash.service.ts` (research R2):
  - `remove(ids)` copies the rows and their tag links, deletes them, writes a `deleted_import_marker` for imported rows (`source` ≠ `manual`), recomputes snapshots of the affected accounts, and returns an `undoToken`.
  - `restore(token)` re-inserts rows and links, removes their markers, recomputes snapshots; unknown or expired tokens (older than 10 s) throw 410.
  - Unit/e2e test in `apps/api/test/e2e/transactions-trash.e2e-spec.ts`: a deleted booking drops out of balance, cashflow and budget and comes back on restore; the token expires after 10 s (fake timers).
- [X] T008 [P] Create `apps/web/app/composables/useCategoryAppearance.ts` (research R9):
  - One 12-color pastel palette, extending the Sankey set, mapped from `category.color` keys.
  - Sub categories inherit the main category's color.
  - Expose `colorOf(categoryId)`, `iconOf(categoryId)` and `shade(categoryId, depth)`.
  - Add a unit test in `apps/web/tests/category-appearance.spec.ts`.
- [X] T009 [P] Add shared UI parts in `apps/web/app/components/common/`, with component tests in `apps/web/tests/common-parts.spec.ts`:
  - `Avatar.vue`: up to 2 initials, background from a stable name hash into the R9 palette.
  - `CopyButton.vue`: clipboard plus toast "Kopiert".
  - `Sparkline.vue`: SVG polyline; flat line if fewer than 2 points.
  - `SortHeader.vue`: header button with an asc/desc arrow and `aria-sort`.
  - `CategoryIcon.vue`: colored tile with a Lucide icon.
- [X] T010 Switch the main tabs to underline style:
  - Change `apps/web/app/layouts/default.vue` (or the main nav component it uses): active tab gets a 2 px bottom border and no background (FR-002).
  - Adjust `e2e/navigation*.spec.ts` selectors if needed.

**Checkpoint**: Foundation ready. Stories can start.

---

## Phase 3: User Story 1 - Review and manage all bookings in one table (Priority: P1) 🎯 MVP

**Goal**: Übersicht › Transaktionen is the full booking workspace, including reviewing.

**Independent Test**: Filter to unreviewed bookings, select 2 rows, set a category. The count drops by 2 and the budget reflects it (quickstart W1–W5).

### Tests for User Story 1

- [X] T011 [P] [US1] Write the API e2e test `apps/api/test/e2e/transactions-query.e2e-spec.ts`. It covers:
  - Each filter (`q`, accounts, types, categories, tags, from/to, min/max, review).
  - Each sort column in both directions.
  - Page sizes 25/50/100 (any size 1–200 is accepted for scripts); `pageSize=500` gives 400.
  - `total` and `sumCents` match the filter.
- [X] T012 [P] [US1] Write the API e2e test `apps/api/test/e2e/transactions-bulk.e2e-spec.ts`. It covers:
  - Bulk actions `setCategory` (sets reviewed), `addTags`, `removeTags`, `markReviewed` with a filter, and `delete`.
  - `ids` and `filter` together gives 400; an empty match gives `affected: 0`.
  - `restore` within 10 s; 410 after expiry.
  - A re-import of the same CSV skips the deleted rows (counted as skipped).
- [X] T013 [P] [US1] Write the API e2e test `apps/api/test/e2e/tags.e2e-spec.ts`: CRUD; a case-insensitive duplicate gives 409; deleting a tag removes its links only.
- [X] T014 [P] [US1] Write the Playwright journey `e2e/us-p1-transactions.spec.ts`, covering quickstart W1–W5: unreviewed filter, bulk category, chip edit, delete plus undo, export of visible columns, `/budget/review` redirect.

### Implementation for User Story 1

- [X] T015 [US1] Implement the query in `apps/api/src/modules/transactions/transactions.service.ts` and `transactions.controller.ts`:
  - Use the DTO from T002.
  - Joins for account name, category icon/color and tags (one grouped query, no N+1).
  - Return `{ items, total, page, pageSize, sumCents }`.
  - Stable order by `(sort, id)`.
- [X] T016 [US1] Implement `POST /transactions/bulk`, `DELETE /transactions/:id` and `POST /transactions/restore` in `apps/api/src/modules/transactions/transactions-write.service.ts`:
  - Delete goes through the undo store from T007 and returns its `undoToken`.
  - A `filter` is resolved with the same query builder as the list (T015).
  - "Set category" uses the review logic in `transactions-review.service.ts` (sets reviewed, manual source).
- [X] T017 [US1] Make `apps/api/src/modules/import/import.service.ts` skip rows whose `(source, fingerprint)` or `(source, source_ref)` is in `deleted_import_marker`; they count as skipped in the job result.
- [X] T018 [P] [US1] Create the `apps/api/src/modules/tags/` module (CRUD under `/tags` with `usage` count) and register it in `apps/api/src/app.module.ts`.
- [X] T019 [US1] Add `GET /transactions/export.csv` in `apps/api/src/modules/transactions/transactions.controller.ts`:
  - Same filter as the query, no paging.
  - `columns[]` picks and orders the columns.
  - `;` separator, UTF-8 BOM, German decimals.
- [X] T020 [P] [US1] Create `apps/web/app/components/transactions/BalanceTile.vue` (balance of the filtered accounts) and `UnreviewedTile.vue`:
  - The tile shows the count and the toggle "Nur ungeprüfte anzeigen".
  - "Alle als geprüft markieren" opens a confirmation that shows the count, then calls bulk `markReviewed` with the current filter.
- [X] T021 [P] [US1] Create `apps/web/app/components/transactions/BookingFilterPanel.vue`:
  - A popover with account, type, category, tag, period, amount range and reviewed state.
  - Show the active-filter count badge.
  - State lives in the route query.
- [X] T022 [US1] Create `apps/web/app/components/transactions/BookingsTable.vue`:
  - UTable with a selection column ("Alle auswählen" for the page).
  - Columns: Name (avatar + counterparty + purpose), Datum, Kategorie (editable chip opening a category select), Eigenschaften (tags), Konto, Betrag.
  - `SortHeader` on every column; a dot for unreviewed rows; a delete icon on row hover.
  - Column visibility menu "Spalten", remembered in `localStorage`.
  - Page size 25/50/100 and pagination.
  - Search with a 300 ms debounce.
- [X] T023 [US1] Create `apps/web/app/components/transactions/BulkBar.vue`:
  - Shown while rows are selected.
  - Actions: Kategorie setzen, Tags, Als geprüft markieren, Löschen.
  - Deleting shows a toast with "Rückgängig" for 10 s, which calls restore.
- [X] T024 [P] [US1] Create `apps/web/app/components/transactions/TagManager.vue`: a modal listing tags with usage; create, rename, recolor and delete.
- [X] T025 [US1] Rebuild `apps/web/app/pages/transactions.vue`:
  - BalanceTile and UnreviewedTile side by side (stacked below `md`).
  - Toolbar: search, Filtern, Spalten, Tags, Kategorien (link to settings), Export (CSV of visible columns and filtered rows).
  - Then TransactionsTable and BulkBar.
  - Keep `OverviewSection` wrapping.
- [X] T026 [US1] Turn `apps/web/app/pages/budget/review.vue` into a redirect to `/transactions?review=unreviewed`.
  - Remove "Prüfen" from the Budget section nav in `apps/web/app/pages/budget.vue`.
  - Update the dashboard `ReviewBanner.vue` link.
  - Adjust the existing e2e tests that used `/budget/review`.

**Checkpoint**: US1 works on its own. This is the MVP.

---

## Phase 4: User Story 2 - Portfolios & Konten with details per account (Priority: P1)

**Goal**: Group cards with rich rows and a detail page per account and depot.

**Independent Test**: Open the demo Girokonto. Its detail page shows its history and only its bookings (quickstart W6).

### Tests for User Story 2

- [X] T027 [P] [US2] Write the domain unit test `apps/api/test/unit/sparkline.spec.ts`:
  - 30-day series; fewer than 2 points gives a flat line.
  - IBAN masking `DE12 •••• •••• 3456`.
- [X] T028 [P] [US2] Write the API e2e test `apps/api/test/e2e/accounts-overview.e2e-spec.ts`:
  - Groups and totals.
  - `canSync` false for CSV accounts, with `lastUpdateKind: 'import'`.
  - Detail figures for a period.
  - `POST /accounts/:id/sync` returns 409 for CSV accounts.
- [X] T029 [P] [US2] Write the Playwright journey `e2e/us-p2-accounts.spec.ts` (quickstart W6): copy the IBAN and check the clipboard, open the detail page, depot detail shows positions, "+" preselects the type.

### Implementation for User Story 2

- [X] T030 [P] [US2] Add `apps/api/src/domain/sparkline.ts`, which builds a 30-day series from snapshots, and `maskIban(iban)` in `apps/api/src/domain/iban.ts`.
- [X] T031 [US2] Add `GET /accounts/overview`, `GET /accounts/:id/detail` and `POST /accounts/:id/sync` to `apps/api/src/modules/accounts/` (accounts.service.ts and accounts.controller.ts):
  - Last update comes from `import_job`.
  - `canSync` comes from the data source type.
  - Sync returns 202 only for sync-capable sources.
- [X] T032 [P] [US2] Create `apps/web/app/components/accounts/AccountRow.vue`:
  - Avatar, name/institution, masked IBAN with CopyButton (copies the full IBAN), Sparkline, "Letzter Import: <date>" or "Aktualisieren" plus "Zuletzt …", and the balance.
  - The whole row links to the detail page.
- [X] T033 [P] [US2] Create `apps/web/app/components/accounts/AccountGroupCard.vue`: a card with the title (Depots / Konten), the total, and a "+" that opens `AccountFormModal` with the type preselected.
- [X] T034 [US2] Rebuild `apps/web/app/pages/accounts.vue`: one group card per group from `/accounts/overview`, with Anpassen and Hinzufügen in the SectionNav actions row.
- [X] T035 [US2] Create `apps/web/app/pages/accounts/[id].vue`:
  - Header with avatar, name and balance.
  - History chart with PeriodTabs.
  - Key figures tiles.
  - `BookingsTable` with `accountIds=[id]`.
- [X] T036 [US2] Create `apps/web/app/pages/depots/[id].vue`: like the account page, plus `PositionsTable` and the investment bookings filtered to this depot. This needs an `accountIds` prop on `PositionsTable.vue`.

**Checkpoint**: US1 and US2 both work.

---

## Phase 5: User Story 3 - Budget area like the reference (Priority: P2)

**Goal**: Analyse | Sankey | Budgets, a period picker, category icons and details, one color per category.

**Independent Test**: Pick September 2026, open Sankey, click "Wohnen". The table shows only Wohnen bookings from September (quickstart W7–W8).

### Tests for User Story 3

- [X] T037 [P] [US3] Write the component test `apps/web/tests/period-picker.spec.ts`:
  - "Aktueller Monat" is disabled while active.
  - The month dropdown sets `?period=`.
  - Range label "01.09. – 30.09.".
- [X] T038 [P] [US3] Write the API e2e test `apps/api/test/e2e/category-detail.e2e-spec.ts`:
  - `icon` is validated against `CATEGORY_ICONS` (an unknown key gives 400).
  - The detail returns a 12-month history and the total for the period.
- [X] T039 [P] [US3] Write the Playwright journey `e2e/us-p3-budget.spec.ts` (quickstart W7–W8): picker, Sankey click filters the table, icon and color consistent across list, donut and Sankey.

### Implementation for User Story 3

- [X] T040 [US3] Extend `apps/web/app/components/budget/PeriodSwitcher.vue` into the period picker used by all budget pages:
  - Arrows, "Aktueller Monat", and a popover with month/quarter/year selection for the last 5 years.
  - Range label.
  - State stays in the shared `useBudgetPeriod` state, so all budget pages show the same period.
- [X] T041 [US3] Accept and validate `icon` in `apps/api/src/modules/categories/` (create and update).
  - Add `GET /cashflow/categories/:id` (same period query as the other cashflow routes) that returns the total and a 12-month history, sub categories included.
  - Set default icons for the default and demo categories in `apps/api/src/database/demo.ts` and the default category seed.
- [X] T042 [P] [US3] Add an icon and color chooser to `apps/web/app/pages/settings/categories.vue`: an icon grid from `CATEGORY_ICONS` and color swatches from the R9 palette.
- [X] T043 [US3] Use `useCategoryAppearance` and `CategoryIcon` everywhere:
  - `CategoryList.vue`: icon tile instead of the generic tag icon.
  - `CategoryDonut.vue` and `SankeyChart.vue`: slice and block colors.
  - `CashflowBars.vue` stays income/expense (green/red); category colors appear in `MonthBars.vue`.
  - Remove the local `PASTEL` array from `SankeyChart.vue`.
- [X] T044 [US3] Create `apps/web/app/pages/budget/categories/[id].vue`:
  - Header with icon, name and total.
  - 12-month bar history with the current month hatched (new `MonthBars.vue`, also used by the Budgets page).
  - `BookingsTable` filtered to the category and period.
  - An empty state when the period has no bookings.
  - The chevron in `CategoryList.vue` links here (it replaces the inline expand).
- [X] T045 [US3] Create `apps/web/app/pages/budget/sankey.vue`:
  - PeriodPicker, a Sankey card (move the card and the €/% toggle out of `budget/index.vue`), and the `BookingsTable` below, filtered by period.
  - `SankeyChart.vue` emits `select(categoryId)` on node click; clicking again clears it. This toggles the `categoryIds` filter.
  - Add Sankey to the Budget section nav (Analyse | Sankey | Budgets) in `apps/web/app/pages/budget.vue`.

**Checkpoint**: The Budget area matches the reference navigation.

---

## Phase 6: User Story 4 - Budgets page with comparison chart and table (Priority: P2)

**Goal**: A 12-month chart of budget vs. spending, plus a table with a Gesamtbudget row.

**Independent Test**: Budgets of 500 € and 900 € give a Gesamtbudget of 1.400 €, and an overrun shows in red (quickstart W9).

### Tests for User Story 4

- [X] T046 [P] [US4] Write the domain unit test `apps/api/test/unit/budget-history.spec.ts`:
  - A budget created mid-year gives `null` before its month.
  - Spending includes sub categories.
  - The total row sums correctly.
- [ ] T047 [P] [US4] Write the API e2e test `apps/api/test/e2e/budgets-overview.e2e-spec.ts` (rows, total, series length 12) and the Playwright journey `e2e/us-p4-budgets.spec.ts` (quickstart W9 and the empty state).

### Implementation for User Story 4

- [X] T048 [US4] Add `apps/api/src/domain/budget-history.ts` and `GET /budgets/overview?period=` in `apps/api/src/modules/budgets/`, following contracts/http-api.md.
- [ ] T049 [P] [US4] Create `apps/web/app/components/budget/BudgetChart.vue`:
  - Grouped bars per month (budget vs. spent), with the hover and dim behaviour of `CashflowBars`.
  - Toggle "Gesamtbudget": total vs. a per-budget select.
  - Gaps where the budget is `null`.
- [ ] T050 [P] [US4] Create `apps/web/app/components/budget/BudgetTable.vue`:
  - Columns: category (icon + name), Budgethöhe, Ausgaben, Status (progress bar, red when over), Differenz (negative in red).
  - A Gesamtbudget footer row.
  - Row menu ⋮ with Bearbeiten and Löschen (with confirmation).
- [ ] T051 [US4] Rebuild `apps/web/app/pages/budget/budgets.vue`:
  - PeriodPicker, the BudgetChart card, and the BudgetTable card with "Hinzufügen", which opens the budget dialog (reuse the existing form inside a `UModal`).
  - Empty state with "Hinzufügen" when there are no budgets.
  - Remove `BudgetProgressList.vue` if it is no longer used.

---

## Phase 7: User Story 5 - Investments details like the reference (Priority: P2)

**Goal**: Sorting, copy, avatars, legend, filter panel, Zeiträume, dividend split by region and sector, Vorabpauschale per broker.

**Independent Test**: Sort by Kursgewinn, copy an ISIN, select "Zeiträume", check the region split (quickstart W10).

### Tests for User Story 5

- [ ] T052 [P] [US5] Write the domain unit test `apps/api/test/unit/trailing-returns.spec.ts`:
  - 1M, 3M, YTD, 1J, 3J, 5J and Gesamt against known cash flows.
  - Periods longer than the history start at the first data point.
- [ ] T053 [P] [US5] Write the API e2e test `apps/api/test/e2e/investments-refinements.e2e-spec.ts`:
  - `/investments/transactions` sort and filter.
  - `/analysis/returns/trailing`.
  - `/dividends/split?by=region` sums to the total.
  - Vorabpauschale grouped by broker with subtotals.
- [ ] T054 [P] [US5] Write the Playwright journey `e2e/us-p5-investments.spec.ts` (quickstart W10).

### Implementation for User Story 5

- [ ] T055 [US5] Update `apps/web/app/components/investments/PositionsTable.vue`:
  - `SortHeader` on every column (TanStack sorting).
  - Avatar in the name cell.
  - CopyButtons next to WKN and ISIN.
  - Replace the asset-class `USelect` with shared state `useState('assetClass')`.
- [ ] T056 [US5] Add the asset legend to `apps/web/app/components/investments/PerformanceChart.vue`: chips "Alle / Aktien / ETF / …" above the chart, bound to `useState('assetClass')`, filtering both chart and table.
- [ ] T057 [US5] Add sort and filter query parameters to `GET /investments/transactions` in `apps/api/src/modules/investments/`.
  - Add a filter panel (type, depot, security, period, amount) with an active count to `apps/web/app/pages/investments/transactions.vue`.
  - All columns are sortable.
- [ ] T058 [US5] Add `trailingReturns(asOf)` to `apps/api/src/domain/period-returns.ts` and the endpoint `GET /analysis/returns/trailing` in `apps/api/src/modules/analysis/`.
  - Add a "Jahre | Zeiträume" switch to `apps/web/app/components/analysis/YearlyTable.vue`, with IZF, inflation and real return per period.
- [ ] T059 [US5] Add `GET /dividends/split?by=security|region|sector` in `apps/api/src/modules/dividends/`, reusing `domain/breakdown.ts` weights.
  - Add an "Aufteilung" card with tabs Wertpapiere | Regionen | Branchen (donut + list) to `apps/web/app/pages/investments/dividends.vue`.
- [ ] T060 [US5] Rework `apps/web/app/components/dividends/DividendCalendar.vue` into a month grid: 12 months, payments per month with avatar and amount. Below `sm`, keep the list.
- [ ] T061 [US5] Group the Vorabpauschale response by depot institution, with subtotals, in `apps/api/src/modules/taxes/`, and render the groups in `apps/web/app/pages/investments/taxes.vue`.

---

## Phase 8: User Story 6 - Dashboard refinements (Priority: P3)

**Goal**: A custom range and a menu on the net-worth chart, an unreviewed card, avatars.

**Independent Test**: Range 01.03.–30.06.2026: the chart and the gain cover exactly that range (quickstart W11).

- [ ] T062 [P] [US6] Write the API e2e test for `/overview/net-worth?from=&to=` in `apps/api/test/e2e/overview-range.e2e-spec.ts`. A range longer than the data starts at the first point.
- [ ] T063 [US6] Accept `from` and `to` on `GET /overview/net-worth` in `apps/api/src/modules/overview/overview.service.ts`, with validation `from ≤ to`.
- [ ] T064 [P] [US6] Create `apps/web/app/components/common/DateRangePicker.vue`: a popover with two `UCalendar`s, presets, and German date format.
- [ ] T065 [US6] Update `apps/web/app/components/dashboard/NetWorthChart.vue`:
  - Add a DateRangePicker next to PeriodTabs. With a custom range, no tab is active and the range is shown as text.
  - Add a ⋮ menu with the toggles "Investiertes Kapital" and "Benchmark", remembered via `user_setting`.
- [ ] T066 [US6] Replace `apps/web/app/components/dashboard/ReviewBanner.vue` with an `UnreviewedCard.vue` dashboard card:
  - It shows the count and the latest 3 bookings, and links to `/transactions?review=unreviewed`.
  - Register it in the dashboard layout list and `CustomizeModal.vue`.
- [ ] T067 [P] [US6] Add the avatar to `apps/web/app/components/dashboard/HoldingsCard.vue` rows.
- [ ] T068 [US6] Write the Playwright journey `e2e/us-p6-dashboard.spec.ts`: custom range, menu toggle persists after reload, unreviewed card link.

---

## Phase 9: User Story 7 - Global search (Priority: P3)

**Goal**: The magnifier and Ctrl/Cmd+K open a search over pages, securities, accounts and bookings.

**Independent Test**: "MSCI" opens the security. "Vermieter" lands in Transaktionen filtered to that text (quickstart W11).

- [ ] T069 [P] [US7] Write the API e2e test `apps/api/test/e2e/search.e2e-spec.ts`:
  - Fewer than 2 characters gives 400.
  - Groups are capped at 5 each.
  - IBAN and ISIN match.
  - Soft-deleted bookings are excluded.
- [ ] T070 [US7] Create the `apps/api/src/modules/search/` module with `GET /search?q=`, using `LIKE` queries per group as in research R3, and register it in `app.module.ts`.
- [ ] T071 [US7] Create `apps/web/app/components/common/GlobalSearch.vue`:
  - A `UCommandPalette` in a `UModal` with a 200 ms debounce.
  - Groups: Seiten, Wertpapiere, Konten, Transaktionen.
  - "Keine Treffer" when empty.
  - Enter navigates; a transaction hit goes to `/transactions?q=`.
  - Wire it to the header magnifier and to `defineShortcuts({ meta_k })` in `apps/web/app/layouts/default.vue`.
- [ ] T072 [US7] Write the Playwright journey `e2e/us-p7-search.spec.ts`: Ctrl+K, type "Giro", Enter opens the account; "Vermieter" opens the filtered table.

---

## Phase 10: User Story 8 - Typography and tabs like the reference (Priority: P3)

**Goal**: Outfit everywhere and underline tabs. Both were mostly delivered in T004 and T010; this phase verifies them.

**Independent Test**: The computed font is Outfit, and no third-party host is requested (quickstart W12).

- [ ] T073 [US8] Write the Playwright test `e2e/us-p8-look.spec.ts`:
  - `getComputedStyle(document.body).fontFamily` starts with `Outfit`.
  - The active main tab has a bottom border and a transparent background.
  - Visit every page and assert that all network requests go to the app origin (SC-007).
- [ ] T074 [US8] Check card titles, tables and charts in `apps/web/app/assets/css/main.css` and `app.config.ts` for Outfit metrics. Adjust the font size and line height where text now overflows, for example card header h2 and SankeyChart labels.

---

## Phase 11: Polish & Cross-Cutting Concerns

- [ ] T075 [P] Extend `e2e/responsive.spec.ts` with these pages at 360 px in dark and light: `/transactions`, `/accounts/:id`, `/depots/:id`, `/budget/sankey`, `/budget/budgets`, `/budget/categories/:id`. Check that there is no horizontal scroll and no "NaN".
- [ ] T076 [P] Extend the perf script in `apps/api/scripts/perf.ts`:
  - Seed 10,000 bookings.
  - Measure `/transactions` sort/filter/page p95 (target < 1 s) and `/search` p95 (target < 300 ms).
  - Write the results into `specs/003-reference-parity/quickstart.md`.
- [ ] T077 [P] Accessibility pass: `aria-sort`, `aria-selected` and labels for the selection checkboxes, CopyButton, Sparkline (`aria-hidden`) and the search dialog. Check keyboard-only use of the table and the picker.
- [ ] T078 Update `README.md` (feature list) and `docs/` (user guide sections: Transaktionen, Tags, Konten, Budgets, Suche). No private infrastructure details.
- [ ] T079 Run the quickstart walkthroughs W1–W12 against the local dev server, and record the results in `specs/003-reference-parity/quickstart.md`.
- [ ] T080 Run the full gates (`pnpm lint; pnpm format:check; pnpm typecheck; pnpm test; pnpm e2e`), fix the regressions, and mark the spec status "Implemented".

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies.
- **Foundational (Phase 2)**: Depends on Setup. Blocks all stories.
- **US1 (P1)**: After Foundational. It is the MVP.
- **US2 (P1)**: After Foundational. It reuses `BookingsTable` from T022, so start T035/T036 after T022.
- **US3 (P2)**: After Foundational. T044 and T045 reuse `BookingsTable` (T022).
- **US4 (P2)**: After T040 (PeriodPicker). Otherwise independent.
- **US5 (P2)**: After Foundational. Independent of the other stories.
- **US6 (P3)**: After Foundational. T066 links to the US1 route.
- **US7 (P3)**: After Foundational. Independent.
- **US8 (P3)**: After T004 and T010.
- **Polish**: After all desired stories.

### Within Each Story

Tests are written first and fail, then domain, then API, then UI, then the journey passes.

## Parallel Examples

```text
# Setup
T001, T002, T003, T004 together

# Foundational, after T005–T007
T008, T009 together

# US1
T011, T012, T013, T014 (tests) together; then T018, T020, T021, T024 together

# US5
T052, T053, T054 together; then T055/T056 (same state, sequential) and T058, T059, T061 in parallel
```

## Implementation Strategy

### MVP First

1. Phase 1, then Phase 2, then US1 (T011–T026).
2. Validate with quickstart W1–W5, then commit and push.

### Incremental Delivery

1. US1: transactions workspace.
2. US2: accounts.
3. US3 and US4: budget.
4. US5: investments.
5. US6, US7 and US8: polish stories.

Each story is demoable on its own. Open work from 001 (Scalable T054–T058, deploy T079–T083) stays tracked in feature 001.
