---

description: "Task list for feature 002: investment analysis, dividends, taxes, benchmarks, watchlists"
---

# Tasks: Investment Analysis, Dividends, Taxes and Watchlists

**Input**: Design documents from `specs/002-investment-analysis/`

**Prerequisites**: plan.md, spec.md, research.md (R1–R15), data-model.md, contracts/http-api.md, quickstart.md (W1–W16)

**Tests**: Requested (same layering as 001): domain unit tests (Vitest), Nest e2e tests via `inject()`, one Playwright journey per story, plus the responsive check.

**Organization**: Tasks are grouped by user story so each story can be built, tested and shipped on its own.

**Feature 001 stays open**: US3 Scalable sync (001 T054–T058) and deployment (001 T079–T083) remain in `specs/001-wealth-tracker-dashboard/tasks.md`. Nothing here replaces or blocks them.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story from spec.md (US1–US7)
- Paths: `apps/api/`, `apps/web/`, `packages/shared/`, `e2e/` (monorepo from 001)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Shared key lists and DTO skeletons used by several stories

- [X] T001 [P] Add classification key lists to `packages/shared/src/classification.ts`: `REGIONS` (Nordamerika, Europa, Japan, Pazifik ex Japan, Schwellenländer, Sonstige), the 11 GICS `SECTORS`, `CURRENCIES` (ISO 4217 subset incl. EUR, USD, GBP, CHF, JPY), `FUND_TYPES = ['equity','mixed','other']` with German labels and partial exemption rates (0.30, 0.15, 0), and `UNASSIGNED_KEY`; export from `packages/shared/src/index.ts`
- [X] T002 [P] Add zod DTO schemas for analysis, dividends, taxes, benchmarks, watchlists and instrument classification exactly as in `specs/002-investment-analysis/contracts/http-api.md` to `packages/shared/src/dto/` (one file per area) and export them
- [X] T003 [P] Add German i18n keys for the new pages, navigation, empty states and errors (e.g. "Nicht zugeordnet", "Basiszins fehlt", "Sparerpauschbetrag überschritten", "Keine Kurse") to `apps/web/i18n/locales/de.json`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema, instruments module, price list import and navigation that several stories need

**⚠️ CRITICAL**: No user story work starts before this phase is complete

- [X] T004 Extend `apps/api/src/database/schema.ts` per `data-model.md`: `instrument.fund_type` (nullable, `equity` | `mixed` | `other`), `instrument.is_benchmark` (bool, default 0); new tables `instrument_weight` (PK `(instrument_id, dimension, key)`, `dimension` ∈ `region|sector|currency`, `weight` decimal "0 < w ≤ 1"), `custom_grouping` (name 1–60, unique), `custom_group` (name 1–60, unique `(grouping_id, name)`, position), `custom_group_member` (PK `(grouping_id, instrument_id)`), `inflation_rate` (year PK 1990–2100, rate decimal −0.1 … 0.5), `expected_dividend` (ex_date ≤ pay_date, amount_per_share > 0, note ≤ 200), `tax_year` (assessment `single|joint`, base_rate decimal 0 … 0.2 nullable), `exemption_order` (amount_cents ≥ 0, unique `(institution_id, year)`), `watchlist` (name 1–60 unique, position), `watchlist_entry` (PK `(watchlist_id, instrument_id)`, position, added_at), `user_setting` (key PK, value nullable); all FKs cascade as listed
- [X] T005 Generate migration `apps/api/src/database/migrations/0005_investment_analysis.sql` with `pnpm --filter api db:generate`, backfill `fund_type = 'equity'` for existing instruments with asset class `etf`/`fund`, and extend `apps/api/test/e2e/` migration smoke checks so all 001 tests stay green
- [X] T006 [P] Add `apps/api/src/domain/rounding.ts` with `largestRemainder(values: number[], totalCents: number): number[]` and unit tests in `apps/api/test/unit/rounding.spec.ts` (sum always equals total, stable order on ties)
- [X] T007 Create `apps/api/src/modules/instruments/` (module, controller, service): `POST /api/instruments` (`{ isin, name, assetClass, isBenchmark? }`, ISIN checksum validated, 409 if it exists) and `POST /api/instruments/:id/prices` (`{ prices: [{ date, close }] }`, upsert by `(instrument_id, date)` with `source = 'manual'`, close > 0); register in `apps/api/src/app.module.ts`
- [X] T008 [P] E2E test for instrument creation and manual prices (duplicate ISIN 409, bad checksum 400, upsert keeps one row per day) in `apps/api/test/e2e/instruments.e2e-spec.ts`
- [X] T009 Add the "Kursliste" CSV format in `apps/api/src/modules/sources/csv/price-list.ts` (header `Datum;Schlusskurs`, optional `ISIN`, dates `DD.MM.YYYY` or ISO, decimal comma or point), detection in `apps/api/src/modules/sources/csv/detector.ts`, and the import path in `apps/api/src/modules/import/import.service.ts` (confirm takes `{ instrumentId }` when no ISIN column; job counts `imported`, `updated`, `skipped`; prices stored with `source = 'csv'`)
- [X] T010 [P] Fixtures `apps/api/test/fixtures/csv/price-list.csv` and `price-list-isin.csv` plus unit tests for parsing in `apps/api/test/unit/price-list.spec.ts` and an e2e upload/confirm test in `apps/api/test/e2e/import-prices.e2e-spec.ts`; document the format in `specs/001-wealth-tracker-dashboard/contracts/csv-formats.md`
- [X] T011 [P] Extend `apps/web/app/components/investments/InvestmentsNav.vue` to six entries (Positionen, Transaktionen, Analyse, Dividenden, Steuern, Watchlists), horizontally scrollable below `sm` like the main tabs
- [X] T012 [P] Add a "Kurse importieren" option for instruments to `apps/web/app/components/import/CsvUpload.vue` (instrument picker shown when the detected format is `price-list` without ISIN)

**Checkpoint**: Schema migrated, prices can be imported for any instrument, navigation lists all new pages

---

## Phase 3: User Story 1 - Analyse portfolio composition and returns (Priority: P1) 🎯 MVP

**Goal**: Investments › Analyse shows breakdowns (asset class, region, sector, currency, volatility, return, custom groups), return line/heatmap/bars, yearly IZF vs. inflation vs. real return, and depot comparison

**Independent Test**: With demo data, classify one ETF by region, open Analyse, check that region buckets sum to the depot value to the cent and that the heatmap's yearly totals equal the yearly table (W1–W5)

### Tests for User Story 1

- [X] T013 [P] [US1] Unit tests for weighted breakdown (weights, remainder as "Nicht zugeordnet", cash bucket, Σ = total) in `apps/api/test/unit/breakdown.spec.ts`
- [X] T014 [P] [US1] Unit tests for volatility (σ × √252 on daily log returns, < 60 points → not computable, class thresholds 10 % / 20 %) in `apps/api/test/unit/volatility.spec.ts`
- [X] T015 [P] [US1] Unit tests for monthly/yearly TWROR and yearly XIRR against `apps/api/test/fixtures/returns-reference.json` in `apps/api/test/unit/period-returns.spec.ts`
- [X] T016 [P] [US1] E2E tests for `/api/analysis/breakdown` (all dimensions), `/api/analysis/returns`, `/api/analysis/compare`, classification PUT (400 when a dimension sums > 1, message names the sum), groupings CRUD and members, inflation settings in `apps/api/test/e2e/analysis.e2e-spec.ts`

### Implementation for User Story 1

- [X] T017 [P] [US1] Implement `apps/api/src/domain/breakdown.ts` (positions × weights, custom group membership weight 1, cash bucket, largest-remainder rounding from T006)
- [X] T018 [P] [US1] Implement `apps/api/src/domain/volatility.ts` (annualized σ of daily log returns over the last 365 days, ≥ 60 price points, classes niedrig < 10 %, mittel 10–20 %, hoch > 20 %)
- [X] T019 [P] [US1] Implement `apps/api/src/domain/period-returns.ts` (monthly TWROR chain-linked from the daily series with `r = V_t/(V_{t-1}+F_t) − 1`, yearly product, yearly XIRR via `xirr(periodCashFlows(...))`, current year flagged `ytd`, real return via `realReturn()`)
- [X] T020 [US1] Implement classification endpoints `GET/PUT /api/instruments/:id/classification` (weights per dimension, `fundType`, `isBenchmark`; reject Σ weight > 1 per dimension) in `apps/api/src/modules/instruments/classification.service.ts` and the instruments controller
- [X] T021 [US1] Create `apps/api/src/modules/analysis/` with `AnalysisService` (breakdown by `assetClass|region|sector|currency|volatility|return|grouping`, return classes < −10 %, −10–0 %, 0–10 %, 10–25 %, > 25 %), returns (series, months, years with inflation from `inflation_rate` falling back to `owner.inflation_rate`) and compare (per-depot TWROR rebased to 0 % on the first common day); controller routes per contract; register module
- [X] T022 [US1] Implement groupings (`GET/POST /api/groupings`, `PATCH/DELETE /api/groupings/:id`, `PUT /api/groupings/:id/members` with one group per grouping and instrument) and inflation settings (`GET/PUT /api/settings/inflation`) in `apps/api/src/modules/analysis/groupings.service.ts` and `inflation.service.ts`
- [X] T023 [P] [US1] Build `apps/web/app/components/analysis/BreakdownCard.vue` (dimension tabs Assetklassen, Regionen, Branchen, Währungen, Volatilität, Rendite, Eigene Aufteilung; donut with `.chart-hover` + list with value, share and count; €/% toggle)
- [X] T024 [P] [US1] Build `apps/web/app/components/analysis/ReturnViews.vue` (Linie/Heatmap/Balken switch with PeriodTabs), `ReturnHeatmap.vue` (CSS grid months × years, diverging color scale, values as text) and `YearlyTable.vue` (Jahr, IZF, Inflation, Realrendite; current year marked YTD)
- [X] T025 [P] [US1] Build `apps/web/app/components/analysis/CompareChart.vue` (depot multi-select, one line per depot, legend, tooltip)
- [X] T026 [P] [US1] Build `apps/web/app/components/analysis/ClassificationForm.vue` (per dimension: rows key + %, live sum, "Nicht zugeordnet" remainder, fund type select) and add a "Klassifizierung" section to `apps/web/app/pages/investments/[instrumentId].vue`
- [X] T027 [P] [US1] Build `apps/web/app/components/analysis/GroupingEditor.vue` (create/rename groupings and groups, assign instruments) opened from BreakdownCard
- [X] T028 [P] [US1] Add a yearly inflation editor to `apps/web/app/pages/settings/` (new `inflation.vue`, linked from settings navigation)
- [X] T029 [US1] Create `apps/web/app/pages/investments/analysis.vue` combining BreakdownCard, ReturnViews, YearlyTable and CompareChart with the depot filter
- [X] T030 [US1] Extend `apps/api/src/database/demo.ts` with region/sector/currency weights for the demo ETFs, one grouping "Kern/Satellit", and inflation rates for the demo years; regenerate `apps/api/test/fixtures/demo-expected.json` only if 001 totals change (they must not)
- [X] T031 [P] [US1] Component tests for ReturnHeatmap and ClassificationForm (sum validation) in `apps/web/test/components/`
- [X] T032 [US1] Playwright journey W1–W5 in `e2e/us7-analysis.spec.ts` (desktop only, with cleanup)

**Checkpoint**: Analyse page works on its own — MVP

---

## Phase 4: User Story 2 - Track dividend income (Priority: P2)

**Goal**: Investments › Dividenden with summary, yearly history, per-security split and a calendar of expected and received payments

**Independent Test**: With demo dividends, "Letzte 12 Monate" equals Σ dividend transactions in the window; an expected payment shows with shares × amount per share (W6–W7)

### Tests for User Story 2

- [X] T033 [P] [US2] Unit tests for last-12-months, Ø per month, yield YTD (dividends YTD / average daily depot value YTD), CAGR over full years (< 2 years → null), expected amount from holdings on the pay date and received/expected matching per instrument and month in `apps/api/test/unit/dividends.spec.ts`
- [X] T034 [P] [US2] E2E tests for `/api/dividends/summary`, `/api/dividends/calendar` and expected-dividend CRUD (`ex_date ≤ pay_date`, `amount_per_share > 0`, `note ≤ 200`) in `apps/api/test/e2e/dividends.e2e-spec.ts`

### Implementation for User Story 2

- [X] T035 [P] [US2] Implement `apps/api/src/domain/dividends.ts` (summary figures, yearly rows with change to previous year, per-security split, expected amount via FIFO quantity on the pay date)
- [X] T036 [US2] Create `apps/api/src/modules/dividends/` (service, controller, module) with summary, calendar and expected CRUD per contract; register module
- [X] T037 [P] [US2] Build `apps/web/app/components/dividends/DividendSummary.vue` (tiles Letzte 12 Monate, Ø pro Monat, Dividendenrendite YTD, CAGR) and `DividendHistory.vue` (yearly bar chart + table Jahr, Betrag, Zum Vorjahr)
- [X] T038 [P] [US2] Build `apps/web/app/components/dividends/DividendCalendar.vue` (month list with expected/received badges) and `ExpectedForm.vue` (modal: Wertpapier, Zahltag, Ex-Tag, Betrag je Anteil, Notiz)
- [X] T039 [US2] Create `apps/web/app/pages/investments/dividends.vue` with summary, history, per-security list and calendar
- [X] T040 [US2] Add one expected dividend for the distributing demo ETF to `apps/api/src/database/demo.ts`
- [X] T041 [US2] Playwright journey W6–W7 in `e2e/us8-dividends.spec.ts`

**Checkpoint**: Dividends page works independently

---

## Phase 5: User Story 3 - Bookings as a filterable table (Priority: P2)

**Goal**: Investments › Transaktionen as a paged table with filters, column choice, footer total and CSV export; card layout on phones

**Independent Test**: Filter demo bookings to "Kauf" and one security, export, compare CSV with the visible rows (W8–W9)

### Tests for User Story 3

- [X] T042 [P] [US3] E2E tests for the extended `GET /api/investments/transactions` (filters `type`, `accounts`, `from`, `to`, `instrumentId`; `sort=date|amount`, `dir`; `sumCents` over all filtered rows; paging) and `transactions.csv` (BOM, `;`, de-DE decimals, only requested `columns`) in `apps/api/test/e2e/investments-transactions.e2e-spec.ts`

### Implementation for User Story 3

- [X] T043 [US3] Extend the transactions query and DTO (WKN, ISIN, account name, unit price, quantity, tax, fees) with filters, sort and `sumCents` in `apps/api/src/modules/investments/investments.service.ts` and controller
- [X] T044 [US3] Add `GET /api/investments/transactions.csv` reusing the query and the 001 CSV writer in `apps/api/src/modules/investments/investments.controller.ts`
- [X] T045 [P] [US3] Build `apps/web/app/components/investments/TransactionsTable.vue` (UTable with columns Datum, Typ, Name (WKN/ISIN), Depot, Kaufpreis/Stück, Stück, Steuern, Gebühren, Gesamtbetrag; column visibility as in PositionsTable; server paging 50; footer total; card layout below `sm`)
- [X] T046 [US3] Rebuild `apps/web/app/pages/investments/transactions.vue` with filter bar (Typ, Depot, Zeitraum, Wertpapier), TransactionsTable and Export button passing visible columns and filters
- [X] T047 [US3] Update the 001 journey `e2e/us4-investments.spec.ts` for the new table and add W8–W9 in `e2e/us9-bookings.spec.ts`

**Checkpoint**: Bookings table works independently

---

## Phase 6: User Story 4 - Exemption orders and Vorabpauschale (Priority: P3)

**Goal**: Investments › Steuern with exemption orders per broker (used/remaining, allowance warning) and the Vorabpauschale estimate

**Independent Test**: Orders 800 € and 300 € (single) show the allowance warning; 150 € dividends at broker A show "150,00 € von 800,00 € genutzt"; the estimate matches the three reference cases (W10–W11)

### Tests for User Story 4

- [X] T048 [P] [US4] Create `apps/api/test/fixtures/vorabpauschale-reference.json` with three hand-calculated cases (full year; purchase in month 5 → 4/12 reduction; gain below Basisertrag → capped) including partial exemption 30 %/15 %/0 %
- [X] T049 [P] [US4] Unit tests for `vorabpauschale.ts` against the fixture (to the cent, negative → 0, missing base rate → reason `base_rate_missing`) in `apps/api/test/unit/vorabpauschale.spec.ts`
- [X] T050 [P] [US4] Unit tests for taxable income per institution (dividends gross + interest + realized gains − fees) and usage = min(order, max(0, income)) in `apps/api/test/unit/exemption.spec.ts`
- [X] T051 [P] [US4] E2E tests for `/api/taxes/:year` (allowance 100000/200000 cents by assessment, `exceedsAllowance`), orders CRUD (409 on duplicate institution/year, `amount_cents ≥ 0`), `PUT /api/taxes/:year` (`base_rate` 0 … 0.2) and `/api/taxes/:year/vorabpauschale` in `apps/api/test/e2e/taxes.e2e-spec.ts`

### Implementation for User Story 4

- [X] T052 [P] [US4] Implement `apps/api/src/domain/vorabpauschale.ts` per research R9 (start price of last trading day of previous year, base rate × 0,7, 1/12 reduction per full month before purchase, cap at gain + distributions, minus distributions, partial exemption by fund type, `estimate` flag)
- [X] T053 [P] [US4] Implement `apps/api/src/domain/exemption.ts` (taxable income per institution and year, usage, remaining, allowance check)
- [X] T054 [US4] Create `apps/api/src/modules/taxes/` (service, controller, module) with tax year settings, orders CRUD and Vorabpauschale per contract; register module
- [X] T055 [P] [US4] Build `apps/web/app/components/taxes/ExemptionOrders.vue` (allowance bar "x / 1.000,00 €", per broker used/remaining, add/edit modal, warning banner when exceeded, assessment switch Einzel/Zusammen)
- [X] T056 [P] [US4] Build `apps/web/app/components/taxes/VorabpauschaleTable.vue` (per fund: Basisertrag, Vorabpauschale, steuerpflichtig; total; "Schätzung" label; "Basiszins fehlt" link to the base rate field)
- [X] T057 [US4] Create `apps/web/app/pages/investments/taxes.vue` with year switcher, base rate input, ExemptionOrders and VorabpauschaleTable
- [X] T058 [US4] Add a demo tax year (single, base rate) and one exemption order to `apps/api/src/database/demo.ts`
- [X] T059 [US4] Playwright journey W10–W11 in `e2e/us10-taxes.spec.ts`

**Checkpoint**: Taxes page works independently

---

## Phase 7: User Story 5 - Compare with a benchmark (Priority: P3)

**Goal**: "Vergleichen mit" in the net-worth chart (Rendite) and the investment chart (%), remembered per chart

**Independent Test**: Import a benchmark price list, select it in 1J, end value equals the benchmark's price change; reload keeps it (W12)

### Tests for User Story 5

- [X] T060 [P] [US5] Unit tests for benchmark return series (rebased to 0 % on the period start, carry-forward, stale after 4 days, start at first available price) in `apps/api/test/unit/benchmark.spec.ts`
- [X] T061 [P] [US5] E2E tests for `/api/benchmarks`, `/api/benchmarks/:instrumentId/series` and `GET/PUT /api/settings/charts` (keys allowlisted: `chart.networth.benchmark`, `chart.investments.benchmark`) in `apps/api/test/e2e/benchmarks.e2e-spec.ts`

### Implementation for User Story 5

- [X] T062 [P] [US5] Implement `apps/api/src/domain/benchmark.ts` (return series from prices with 001 carry-forward rule)
- [X] T063 [US5] Create `apps/api/src/modules/benchmarks/` (benchmark list, series, chart settings via `user_setting`); register module
- [X] T064 [P] [US5] Build `apps/web/app/components/common/BenchmarkSelect.vue` (select of benchmarks + "Keiner", link to price import when empty)
- [X] T065 [US5] Add the benchmark line, legend and tooltip value to `apps/web/app/components/dashboard/NetWorthChart.vue` (Rendite mode only) and `apps/web/app/components/investments/PerformanceChart.vue` (% mode), loading and saving the selection via `/api/settings/charts`
- [X] T066 [US5] Add one benchmark instrument with daily prices to `apps/api/src/database/demo.ts` (synthetic, deterministic)
- [ ] T067 [US5] Playwright journey W12 in `e2e/us11-benchmark.spec.ts`

**Checkpoint**: Benchmark comparison works independently

---

## Phase 8: User Story 6 - Watchlists (Priority: P4)

**Goal**: Several watchlists with securities by ISIN and price change per period

**Independent Test**: Create a list, add an invalid then a valid ISIN with imported prices, switch periods (W13)

### Tests for User Story 6

- [ ] T068 [P] [US6] E2E tests for watchlist CRUD (name 1–60 unique), entries (ISIN checksum, creates instrument if missing, duplicate entry rejected) and `GET /api/watchlists/:id?period` (change €/%, `stale`, `hasPrices`) in `apps/api/test/e2e/watchlists.e2e-spec.ts`

### Implementation for User Story 6

- [ ] T069 [US6] Create `apps/api/src/modules/watchlists/` (service, controller, module) per contract, reusing period start resolution from `apps/api/src/domain/period.ts`; register module
- [ ] T070 [P] [US6] Build `apps/web/app/components/watchlists/WatchlistTable.vue` (Name/ISIN, Kurs + Datum, Veränderung €/%, outdated marker, "Keine Kurse" with import link, remove) and `AddSecurityForm.vue` (ISIN + Name with checksum validation)
- [ ] T071 [US6] Create `apps/web/app/pages/investments/watchlists/index.vue` (lists, create/rename/delete) and `[id].vue` (PeriodTabs + WatchlistTable)
- [ ] T072 [US6] Add one demo watchlist with the benchmark instrument to `apps/api/src/database/demo.ts`
- [ ] T073 [US6] Playwright journey W13 in `e2e/us12-watchlists.spec.ts`

**Checkpoint**: Watchlists work independently

---

## Phase 9: User Story 7 - Budget pie chart (Priority: P4)

**Goal**: Pie chart by main category next to the Budget › Analyse category list, €/% toggle, linked hover, click opens the category

**Independent Test**: For November, slices equal the list values and % slices add up to 100 % (± 0,1) (W14)

### Tests for User Story 7

- [ ] T074 [P] [US7] Component test for `CategoryDonut.vue` (slices match input, % sum within 100 ± 0.1, empty state when no data) in `apps/web/test/components/CategoryDonut.spec.ts`

### Implementation for User Story 7

- [ ] T075 [US7] Build `apps/web/app/components/budget/CategoryDonut.vue` (VisDonut with `.chart-hover`, €/% toggle, emits hover/select by category id, empty state)
- [ ] T076 [US7] Integrate it into `apps/web/app/components/budget/CategoryList.vue` / `apps/web/app/pages/budget/index.vue` with a shared `hoveredCategoryId` (row highlight on slice hover and vice versa) and click opening the category like the list
- [ ] T077 [US7] Playwright journey W14 in `e2e/us13-budget-pie.spec.ts`

**Checkpoint**: All user stories independently functional

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T078 [P] Add the new pages (`/investments/analysis`, `/investments/dividends`, `/investments/taxes`, `/investments/watchlists`) to `e2e/responsive.spec.ts` (360/768/1280 px, dark and light, no overflow, no NaN) — W15
- [ ] T079 [P] Extend `apps/api/src/scripts/perf.ts` and `apps/api/src/database/perf-seed.ts` with classifications, dividends and the new endpoints; record results (each page < 2 s, SC-005) in `specs/002-investment-analysis/quickstart.md` — W16
- [ ] T080 [P] Update `README.md`, `apps/api/README.md` and `apps/web/README.md` (new pages, Kursliste CSV, tax estimate disclaimer) and `specs/001-wealth-tracker-dashboard/contracts/http-api.md` cross-reference to the 002 contract
- [ ] T081 [P] Security pass: new endpoints behind `SessionGuard`, zod validation on all bodies/queries, CSV export escapes formula prefixes (`=`, `+`, `-`, `@`) in text cells; add cases to `apps/api/test/e2e/security.e2e-spec.ts`
- [ ] T082 Run quickstart W1–W16 locally with `pnpm dev:local` (web 3100, API 3101) and the full gates (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`); fix regressions; record results in `specs/002-investment-analysis/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: after Setup; blocks all stories (T004 → T005 before any API work; T007 before T009/T020)
- **US1–US7 (Phases 3–9)**: after Foundational; independent of each other, recommended order by priority P1 → P4
- **Polish (Phase 10)**: after the chosen stories; T082 last
- **Feature 001 open work** (US3 Scalable T054–T058, deployment T079–T083 in 001's tasks.md): independent; can run before, between or after 002 phases

### User Story Dependencies

- **US1 (P1)**: Foundational only
- **US2 (P2)**: Foundational only (uses 001 FIFO positions)
- **US3 (P2)**: Foundational only (extends a 001 endpoint)
- **US4 (P3)**: Foundational only; `fund_type` from T004, prices from 001
- **US5 (P3)**: Foundational (price list import T009 provides benchmark prices)
- **US6 (P4)**: Foundational (T007 instruments, T009 prices)
- **US7 (P4)**: none beyond 001 (frontend only)

### Within Each User Story

- Tests first and failing → domain → service/controller → UI → demo data → Playwright journey
- Commit per task (`done.sh`: lint, format, typecheck, leak guard, issue sync)

### Parallel Opportunities

- Setup: T001, T002, T003 together
- Foundational: T006, T008, T010, T011, T012 in parallel once T004/T005/T007 are in
- Stories: after Phase 2, US1–US7 can be split across sessions (separate files except `demo.ts` and `app.module.ts`, which need sequential edits)

## Parallel Example: User Story 1

```text
# Tests together:
T013 breakdown.spec.ts · T014 volatility.spec.ts · T015 period-returns.spec.ts · T016 analysis.e2e-spec.ts

# Domain together:
T017 breakdown.ts · T018 volatility.ts · T019 period-returns.ts

# UI together (after T021/T022):
T023 BreakdownCard · T024 ReturnViews/Heatmap/YearlyTable · T025 CompareChart · T026 ClassificationForm · T027 GroupingEditor · T028 inflation settings
```

## Parallel Example: User Story 4

```text
T048 fixture · T049 vorabpauschale.spec.ts · T050 exemption.spec.ts · T051 taxes.e2e-spec.ts
T052 vorabpauschale.ts · T053 exemption.ts
T055 ExemptionOrders.vue · T056 VorabpauschaleTable.vue
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 + Phase 2
2. Phase 3 (US1 Analyse)
3. **Stop and validate** W1–W5, then local test

### Incremental Delivery

1. Foundation → US1 (MVP) → US2 + US3 (P2) → US4 + US5 (P3) → US6 + US7 (P4) → Polish
2. Each story ends with its Playwright journey and a green gate run
3. Deployment follows 001's pipeline (001 T079–T083) once the owner approves server steps

## Notes

- [P] = different files, no dependency on incomplete tasks
- Every figure in cents/decimal strings; no external data calls
- No private infrastructure details in commits, issues or docs
