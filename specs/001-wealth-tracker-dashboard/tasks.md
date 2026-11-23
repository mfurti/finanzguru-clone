---
description: "Task list for Personal Wealth Tracker Dashboard"
---

# Tasks: Personal Wealth Tracker Dashboard

**Input**: Design documents from `/specs/001-wealth-tracker-dashboard/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: Included. The plan's quality bar requires unit tests for domain math and parsers, Nest e2e tests per controller, and a Playwright journey per user story. Each task ships its code together with its tests. All quickstart quality gates (`pnpm lint`, `pnpm typecheck`, `pnpm test`, plus `pnpm test:e2e` where E2E exists) must pass before the task's commit.

**Organization**: Tasks are grouped by user story. Each task is one commit.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: User story from spec.md (US1–US7)

## Path Conventions

- Frontend: `apps/web/app/…`, component tests in `apps/web/tests/`
- Backend: `apps/api/src/…`, tests in `apps/api/test/{unit,e2e,fixtures}/`
- Shared contracts: `packages/shared/src/…`
- Browser E2E: `e2e/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo, toolchain, runnable empty apps

- [ ] T001 Create pnpm workspace root: `package.json` (private, `engines.node: ">=26 <27"`, `packageManager: pnpm@10`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`), `.nvmrc` (`26`), `.gitignore` (`node_modules`, `.nuxt`, `.output`, `dist`, `apps/api/data/`, `.env`, `*.db`), `.editorconfig`, root `tsconfig.base.json` (strict, `noUncheckedIndexedAccess`)
- [ ] T002 [P] Scaffold `packages/shared` (TS library, `exports` map, `src/index.ts`, build with `tsc -b`) and add `zod`, `decimal.js` in `packages/shared/package.json`
- [ ] T003 [P] Scaffold NestJS 11 app in `apps/api` with the Fastify adapter: `src/main.ts` (global prefix `api`, port from `PORT`, default 3001), `src/app.module.ts`, `nest-cli.json`, `tsconfig.json` extending base, `@nestjs/config` env validation via zod in `src/config/env.schema.ts` (`PORT`, `API_SESSION_SECRET` ≥ 32 bytes, `API_ENCRYPTION_KEY` 32-byte base64, `DATABASE_PATH`), `apps/api/.env.example`
- [ ] T004 [P] Scaffold Nuxt 4 app in `apps/web` with `@nuxt/ui` v4, `@nuxtjs/i18n` (default locale `de`), `assets/css/main.css` (Tailwind v4 + Nuxt UI import), `nuxt.config.ts` with `routeRules: { '/api/**': { proxy: '${API_BASE_URL}/api/**' } }` driven by `runtimeConfig.apiBaseUrl`, and `apps/web/.env.example` (`API_BASE_URL=http://localhost:3001`)
- [ ] T005 Configure tooling at the root: ESLint flat config (`@nuxt/eslint` for web, `typescript-eslint` for api/shared), Prettier, scripts `dev` (parallel api + web), `build`, `lint`, `typecheck` (`vue-tsc --noEmit` web, `tsc --noEmit` api/shared), `test`, `test:e2e`
- [ ] T006 [P] Configure Vitest in `apps/api/vitest.config.ts` (with `unplugin-swc` for decorator metadata, projects `unit` + `e2e`), `apps/web/vitest.config.ts` (`@nuxt/test-utils` environment), and `packages/shared/vitest.config.ts`; add one passing smoke test per workspace
- [ ] T007 [P] Configure Playwright in `e2e/playwright.config.ts`: projects `desktop` (1280×800) and `mobile` (360×780); `webServer` starts api + web against a temp SQLite file; add a smoke test `e2e/smoke.spec.ts` that opens `/login`
- [ ] T008 [P] Add GitHub Actions CI in `.github/workflows/ci.yml`: Node 26, pnpm cache, `pnpm install --frozen-lockfile`, lint, typecheck, test, Playwright (desktop + mobile)

**Checkpoint**: `pnpm dev` serves web on :3000 proxying to api on :3001; all gates green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: DB, auth, shared contracts, domain primitives, app shell, demo seed. No user story starts before this phase is complete.

- [ ] T009 Add Drizzle ORM + `better-sqlite3` + `drizzle-kit` in `apps/api` and create `apps/api/src/database/drizzle.module.ts` (global provider `DB`, WAL mode, foreign keys on, path from `DATABASE_PATH`) and `drizzle.config.ts`; verify `better-sqlite3` installs on Node 26 (research R2) and record the outcome in `apps/api/README.md`
- [ ] T010 Define the full Drizzle schema in `apps/api/src/database/schema.ts` per data-model.md, quoting the constraints: ids `TEXT` UUIDv7; money `INTEGER` cents; decimals `TEXT`; `owner.inflation_rate` "default `0.0253`, 0–0.5"; `account.name` "1–80"; `account.type` enum `depot|checking|savings|reference|credit_card|cash`; `account.iban` "validated IBAN checksum; unique when set"; `instrument.isin` "unique, ISIN checksum"; `instrument.wkn` "6 chars"; `price` PK `(instrument_id, date)` with "close > 0"; `transaction` index `(account_id, booking_date)`, unique `(source, source_ref)`, unique `fingerprint`, `review_status` default `unreviewed`, `fee_cents`/`tax_cents` default 0; `category` "max depth 2", "unique within parent"; `categorization_rule.priority` "ascending, unique"; `budget.category_id` unique and "> 0" limit; `insurance_contract.premium_cents` "> 0", `end_date` "≥ start_date", `notes` "≤ 2000"; `import_job.errors` "max 500 kept"; `csv_mapping.header_signature` unique; `dashboard_layout.widget_key` PK; derived tables `net_worth_snapshot` PK `(account_id, date)` and `position_lot`. Generate the first migration in `apps/api/src/database/migrations/` and add `db:migrate` script
- [ ] T011 [P] Create shared enums and zod schemas for all entities and API payloads in `packages/shared/src/schemas/` (`account.ts`, `instrument.ts`, `transaction.ts`, `category.ts`, `budget.ts`, `insurance.ts`, `source.ts`, `import.ts`, `overview.ts`, `investments.ts`, `cashflow.ts`, `common.ts` with `period`, `accounts`, date and cents primitives) matching contracts/http-api.md
- [ ] T012 [P] Implement money/decimal and de-DE formatting helpers in `packages/shared/src/format.ts` (`formatEur(cents)` → `1.856,45 €`, signed variants, `formatPct`, `formatDate`) and IBAN/ISIN checksum validators in `packages/shared/src/validators.ts`, with unit tests in `packages/shared/test/`
- [ ] T013 Wire validation and docs in `apps/api/src/main.ts`: global `ZodValidationPipe` (`nestjs-zod`), `@nestjs/swagger` at `/api/docs` (dev only) with the nestjs-zod patch, global exception filter in `apps/api/src/common/filters/http-exception.filter.ts` producing `{ statusCode, statusMessage, data?: { issues } }`, `nestjs-pino` logging with redaction of cookies/authorization
- [ ] T014 Implement `CryptoService` (AES-256-GCM, `iv|tag|ciphertext`, key from `API_ENCRYPTION_KEY`) in `apps/api/src/common/crypto.service.ts` with unit tests for round trip and tamper detection in `apps/api/test/unit/crypto.service.spec.ts`
- [ ] T015 Implement `AuthModule` in `apps/api/src/modules/auth/`: `@fastify/secure-session` (httpOnly, `sameSite=lax`, `secure` in prod), scrypt password hashing, `POST /api/auth/login` (`@Public()`, `@nestjs/throttler` 5/min), `POST /api/auth/logout`, `GET /api/auth/session`, global `SessionGuard`; CLI script `owner:set-password` in `apps/api/src/scripts/set-password.ts`; e2e tests in `apps/api/test/e2e/auth.e2e-spec.ts` (401 without cookie, 204 on login, throttling)
- [ ] T016 [P] Implement domain primitives in `apps/api/src/domain/money.ts` (cents arithmetic, `decimal.js` helpers, EUR rounding half-even) and `apps/api/src/domain/period.ts` (resolve `1W|1M|YTD|1Y|3Y|5Y|ALL` and `from/to` to date ranges, month/quarter/year anchors) with unit tests
- [ ] T017 Seed default German category tree (FR-031: Wohnen › Miete/Wohngeld, Strom, Wohnnebenkosten; Lebenshaltung › Lebensmittel und Getränke, Handy, Festnetz und Internet, Sonstige; Shopping und Unterhaltung; Sparen und Anlegen › Wertpapieranlage; Versicherung › Risiko-Lebensversicherung; Bank und Kredit; Gesundheit und Wellness › Arznei- und Heilmittel; Freizeit, Hobbies und Soziales; Einnahmen › Gehalt, Sonstige Einnahmen; Umbuchung) with `is_default = true`, default dashboard layout, `Manuell` institution, and data sources `csv` (active) + `sparkasse_fints` (planned) in `apps/api/src/database/seed.ts`; `db:seed` script
- [ ] T018 Build a synthetic demo dataset generator `apps/api/src/database/demo.ts` (`db:seed --demo`): 1 depot with 3 ETFs + 2 stocks incl. one fully sold position, 1 reference account, 1 checking account, 3 years of daily prices and monthly salary/rent/groceries transactions; deterministic seed so tests can assert totals
- [ ] T019 [P] Define the `DataSource` interface and normalized types in `packages/shared/src/sources.ts` and `apps/api/src/modules/sources/data-source.interface.ts` exactly as in contracts/data-source.md, plus errors `ForbiddenToolError`, `AuthExpiredError`, `UpstreamError`, `NotImplementedError` in `apps/api/src/modules/sources/errors.ts`
- [ ] T020 Implement domain derivations used by several stories: `apps/api/src/domain/positions.ts` (FIFO lots, average entry price of open lots, realized gain on sell, split ratio on open lots — research R9) and `apps/api/src/domain/snapshots.ts` (daily `value_cents`, `invested_cents`, `external_flow_cents` per account; last known price carried forward and flagged stale) with unit tests incl. split and partial-sell cases in `apps/api/test/unit/positions.spec.ts`, `snapshots.spec.ts`
- [ ] T021 Implement `RecomputeService` in `apps/api/src/modules/import/recompute.service.ts` that rebuilds `position_lot` and `net_worth_snapshot` for given accounts from a start date inside the caller's DB transaction; run it at the end of `db:seed --demo`
- [ ] T022 Build the app shell in `apps/web/app/layouts/default.vue`: header with own logo/name (research R15), search/menu/profile slots, `UTabs`-style nav for Übersicht / Investments / Budget / Versicherung, floating global account filter (`components/common/AccountFilter.vue`, state in `composables/useAccountFilter.ts` synced to `?accounts=`), color-mode toggle; brand theme in `apps/web/app/app.config.ts`
- [ ] T023 [P] Add the login page `apps/web/app/pages/login.vue`, the global route middleware `apps/web/app/middleware/auth.global.ts` (redirect to `/login` on 401), and typed `useApi` composable `apps/web/app/composables/useApi.ts` (uses `useRequestFetch` on SSR to forward cookies; types from `@app/shared`)
- [ ] T024 [P] Add shared UI atoms in `apps/web/app/components/common/`: `Money.vue` (green/red by sign, FR-004), `Percent.vue`, `PeriodTabs.vue` (1W…All-time), `EmptyState.vue`, `InfoTooltip.vue`, plus placeholder pages for all four tabs; component tests in `apps/web/tests/common.spec.ts`

**Checkpoint**: Log in, see the shell with four tabs and the account filter; the demo seed is in the DB.

---

## Phase 3: User Story 1 - See total net worth at a glance (Priority: P1) 🎯 MVP

**Goal**: The Übersicht tab with all eight widgets on real or demo data.

**Independent Test**: `pnpm --filter api db:seed --demo`, open `/`; every widget is filled and Gesamtvermögen = Σ depot values + Σ cash (quickstart V5–V7).

- [ ] T025 [P] [US1] Implement `apps/api/src/domain/returns.ts`: TWROR chaining of daily sub-period returns, XIRR (Newton–Raphson with bisection fallback, tolerance 1e-10), real return `(1+n)/(1+i)-1` (research R8); unit tests against reference values exported from `apps/api/test/fixtures/returns-reference.xlsx` (stored alongside as `returns-reference.json`), with ≤ 0.01 pp deviation (SC-007)
- [ ] T026 [US1] Implement `OverviewModule` `GET /api/overview/net-worth` in `apps/api/src/modules/overview/` (aggregate snapshots over `accounts` and `period`, `mode=value|return`, downsample to ≤ 400 points — research R13) with e2e test on the demo seed in `apps/api/test/e2e/overview-networth.e2e-spec.ts`
- [ ] T027 [US1] Add `GET /api/overview/allocation`, `GET /api/overview/kpis` (invested, price gain, realized gross/net, other gains, dividends, interest, taxes & fees, total return, TWROR, IRR, inflation, real return; nulls when not computable) and `GET /api/overview/holdings/top-flop` to `apps/api/src/modules/overview/` with e2e tests in `apps/api/test/e2e/overview-kpis.e2e-spec.ts`
- [ ] T028 [P] [US1] Implement `AccountsModule` read endpoints `GET /api/accounts/tree` and `GET /api/accounts` in `apps/api/src/modules/accounts/` (groups depots/accounts with subtotals, children for reference accounts) plus `GET /api/transactions/unreviewed/count` in `apps/api/src/modules/transactions/`; e2e tests
- [ ] T029 [P] [US1] Implement `GET/PUT /api/dashboard/layout` in `apps/api/src/modules/overview/layout.controller.ts` (widget keys `networth|allocation|kpis|holdings|accounts|review|cashflow|budgets`) with e2e test
- [ ] T030 [US1] Build `apps/web/app/components/dashboard/NetWorthChart.vue` with Unovis (`VisXYContainer`, `VisArea`, `VisLine`, crosshair tooltip with net worth incl. cash & dividends, invested capital, cash), header with total + gain, Vermögen/Rendite switch, `PeriodTabs`; component test with fixture data
- [ ] T031 [P] [US1] Build `AllocationCard.vue` (Unovis donut, centre total, € / % toggle, legend by asset class) and `KpiCard.vue` (period select, rows per Story 1 scenario 6 with `InfoTooltip`s) in `apps/web/app/components/dashboard/`; component tests
- [ ] T032 [P] [US1] Build `HoldingsCard.vue` (top/flop, range select) and `AccountsCard.vue` (collapsible Depots/Konten groups, institution logo key, subtotals) and `ReviewBanner.vue` (unreviewed count + "Alle anzeigen" link to `/budget/review`) in `apps/web/app/components/dashboard/`; component tests
- [ ] T033 [US1] Assemble `apps/web/app/pages/index.vue`: render widgets in `dashboard_layout` order, all queries keyed by account filter + period, empty states when no data (never `NaN`), "Anpassen" modal to reorder/hide widgets (FR-013) persisted via the layout API. `CashflowCard` and `BudgetsCard` render their empty states until US5 provides data
- [ ] T034 [US1] Add Playwright journey `e2e/us1-overview.spec.ts`: demo seed, check total equals seeded expectation to the cent, switch periods and Vermögen/Rendite, restrict account filter, hide/reorder a widget, desktop + 360 px without horizontal scroll

**Checkpoint**: MVP — overview works end to end on demo data.

---

## Phase 4: User Story 2 - Import data from CSV (Priority: P1)

**Goal**: Idempotent CSV import for Sparkasse and Scalable, plus manual column mapping.

**Independent Test**: Upload the Sparkasse and Scalable fixtures; data appears; re-upload imports 0 rows (quickstart V1–V4).

- [ ] T035 [P] [US2] Create synthetic fixtures in `apps/api/test/fixtures/csv/`: `sparkasse-camt-v8.csv` (Windows-1252, `;`, `DD.MM.YY`), `sparkasse-mt940.csv`, `scalable-transactions.csv` (incl. a `Savings plan`, a `Distribution`, a non-executed row), `malformed.csv`, `unknown-layout.csv`, and `README.md` with expected counts and totals
- [ ] T036 [US2] Implement CSV detection in `apps/api/src/modules/sources/csv/detector.ts` (UTF-8 → Windows-1252 fallback, delimiter sniffing `;`/`,`/`\t`, normalized header signature) with unit tests
- [ ] T037 [P] [US2] Implement the Sparkasse parsers (`sparkasse-camt-v8`, `sparkasse-mt940`) in `apps/api/src/modules/sources/csv/sparkasse.ts` per contracts/csv-formats.md, producing `SyncBatch` with row errors `invalid_date`, `invalid_amount`; unit tests against fixtures
- [ ] T038 [P] [US2] Implement the Scalable parser in `apps/api/src/modules/sources/csv/scalable.ts` (type mapping `Buy`, `Sell`, `Savings plan`, `Distribution`, `Interest`, `Deposit`, `Withdrawal`, `Fee`, `Taxes`, `Corporate action`; skip status ≠ `Executed` as `not_executed`; `reference` → `sourceRef`; row errors `missing_isin`, `invalid_isin`, `missing_quantity`, `unknown_currency_no_rate`); unit tests
- [ ] T039 [P] [US2] Implement the generic mapped parser in `apps/api/src/modules/sources/csv/generic-mapped.ts` (required `date`, `amount`; options delimiter, encoding, date format `DD.MM.YYYY|DD.MM.YY|YYYY-MM-DD`, decimal separator, skip rows); unit tests
- [ ] T040 [US2] Implement `apps/api/src/domain/dedupe.ts` (fingerprint `sha256(accountId|bookingDate|amountCents|norm counterparty|norm purpose|occurrenceIndex)`; `(source, source_ref)` takes precedence — research R10) and `apps/api/src/domain/categorize.ts` (ordered rules, first match wins, never overwrite `manual`; own-IBAN → `transfer` — research R11); unit tests incl. two identical same-day bookings
- [ ] T041 [US2] Implement `ImportPipeline` in `apps/api/src/modules/import/import.pipeline.ts`: upsert institutions/accounts/instruments/prices, dedupe, categorize, insert transactions, call `RecomputeService`, write `import_job` counts and errors (max 500), all in one DB transaction; status `succeeded|partial|failed`; unit/integration tests in `apps/api/test/e2e/import-pipeline.e2e-spec.ts` (SC-003)
- [ ] T042 [US2] Implement `ImportModule` endpoints `POST /api/import/csv` (multipart via `@fastify/multipart`, 20 MB limit, returns `jobId`, `detectedFormat`, `needsMapping`, 10-row preview, headers), `POST /api/import/csv/:jobId/confirm`, `GET /api/import/jobs/:id`, and `GET/POST/DELETE /api/csv-mappings` in `apps/api/src/modules/import/`; e2e tests for V1–V4
- [ ] T043 [P] [US2] Implement manual accounts and transactions (FR-056): `POST/PATCH/DELETE /api/accounts` (delete with transactions → 409 unless `?force=true`) and `POST /api/transactions` in `apps/api/src/modules/accounts/` and `apps/api/src/modules/transactions/`; e2e tests
- [ ] T044 [US2] Build import UI in `apps/web/app/components/import/`: `CsvUpload.vue` (`UFileUpload`, account select), `ColumnMapper.vue` (preview table, per-field select, options, "Zuordnung speichern"), `ImportResult.vue` (imported/skipped/failed + error list with line numbers); page `apps/web/app/pages/settings/sources.vue` listing data sources
- [ ] T045 [US2] Wire the header "Hinzufügen" menu (`apps/web/app/layouts/default.vue`) to "CSV importieren", "Konto anlegen", "Transaktion erfassen" modals; component tests
- [ ] T046 [US2] Add Playwright journey `e2e/us2-csv-import.spec.ts`: upload the Sparkasse fixture, re-upload (0 new), upload malformed (partial + errors), map unknown layout and re-upload auto-detected, overview total updates

**Checkpoint**: Real data can be loaded; US1 works on it.

---

## Phase 5: User Story 3 - Sync my Scalable Capital depot (Priority: P2)

**Goal**: Read-only sync via Scalable's official MCP server.

**Independent Test**: Connect, sync, and compare positions and the reference account with the Scalable app (quickstart V13–V14).

- [ ] T047 [US3] Implement OAuth client provider in `apps/api/src/modules/sources/scalable-mcp/oauth-provider.ts` (MCP SDK `OAuthClientProvider`: dynamic client registration, PKCE verifier and state stored server-side, tokens persisted only via `CryptoService` in `data_source.encrypted_credentials`); redirect URI `http://localhost:3000/api/sources/scalable/callback` (via web proxy); unit tests with a mocked authorization server
- [ ] T048 [US3] Implement `apps/api/src/modules/sources/scalable-mcp/allowlist.ts` (explicit list of read tools; deny any tool whose name/description matches `order|trade|buy|sell|cancel|transfer|savings.?plan|withdraw`; `callTool` wrapper throws `ForbiddenToolError` before sending) with unit tests proving blocked tools never reach the transport (FR-054)
- [ ] T049 [US3] Implement the MCP client in `apps/api/src/modules/sources/scalable-mcp/client.ts` (`StreamableHTTPClientTransport` to `https://mcp.scalable.capital/mcp`, refresh once on 401 then `AuthExpiredError`, other failures `UpstreamError`, timeouts 30 s) and `tools/list` discovery stored in `data_source.tool_manifest` with allowlist decisions
- [ ] T050 [US3] Connect to the real server once with the owner's own login (the owner completes the Scalable login and consent personally), record `tools/list` and read-tool responses, anonymize them, and save them under `apps/api/test/fixtures/scalable-mcp/`; then finalize the allowlist names. If dynamic client registration is refused, stop and report the blocker (research R3)
- [ ] T051 [US3] Implement `apps/api/src/modules/sources/scalable-mcp/mapper.ts` (tool results → `SyncBatch` incl. `positionsSnapshot`) and `ScalableMcpSource` implementing `DataSource`; contract tests against the recorded fixtures in `apps/api/test/unit/scalable-mapper.spec.ts`
- [ ] T052 [US3] Add endpoints `POST /api/sources/scalable/connect`, `GET /api/sources/scalable/callback`, `POST /api/sources/:id/sync` (202, 409 while running, 502 upstream), `DELETE /api/sources/:id`, `GET /api/sources` (never returns credentials) in `apps/api/src/modules/sources/sources.controller.ts`; positions-snapshot mismatch logged as an import-job warning; status transitions `active → needs_reauth → active`, `→ error`; e2e tests with a mocked MCP server
- [ ] T053 [P] [US3] Add optional daily sync via `@nestjs/schedule` in `apps/api/src/modules/sources/sync.scheduler.ts` (disabled unless `SCALABLE_DAILY_SYNC=true`)
- [ ] T054 [US3] Extend `apps/web/app/pages/settings/sources.vue` with a Scalable card: "Scalable Capital verbinden", status badge, last sync, "Synchronisieren", "Verbindung erneuern" on `needs_reauth`, "Trennen"; Playwright journey `e2e/us3-scalable.spec.ts` against the mocked MCP server

**Checkpoint**: The depot refreshes without CSV.

---

## Phase 6: User Story 4 - Investments tab (Priority: P2)

**Goal**: Positions, asset classes, position detail, investment transactions.

**Independent Test**: With demo data, open `/investments`, filter, hide a column, export (quickstart V8).

- [ ] T055 [US4] Implement `InvestmentsModule` in `apps/api/src/modules/investments/`: `GET /api/investments/performance`, `GET /api/investments/positions` (`status=open|sold`, `assetClass` filter; columns per Story 4 scenario 2; sold rows with `realizedCents`), `GET /api/investments/asset-classes`; e2e tests on the demo seed
- [ ] T056 [P] [US4] Implement `GET /api/investments/positions.csv` (`;` separated, de-DE decimals, UTF-8 BOM, only requested columns) and `GET /api/investments/instruments/:id`, `GET /api/investments/transactions` (paging, type filter) in `apps/api/src/modules/investments/`; e2e tests
- [ ] T057 [US4] Build `apps/web/app/components/investments/PerformanceChart.vue` (value vs. invested, € / %, `PeriodTabs`) and `PositionsTable.vue` (`UTable`, asset-type chips Alle/Aktien/ETF/…, column visibility menu, Export button, collapsible "Verkaufte Investments" section) and `AssetClassTable.vue`; component tests
- [ ] T058 [US4] Build pages `apps/web/app/pages/investments/index.vue` (Positionen / Assetklassen views), `investments/transactions.vue`, `investments/[instrumentId].vue` (price/value history + transactions); link holdings and accounts cards on the overview to them
- [ ] T059 [US4] Add Playwright journey `e2e/us4-investments.spec.ts` (filter ETF, hide a column, export contains visible columns only, open a position, sold positions section)

---

## Phase 7: User Story 5 - Budget / cash-flow analysis (Priority: P2)

**Goal**: Period analysis, Sankey, categories, review, rules, budgets.

**Independent Test**: With demo data, open `/budget`; figures, 12 bars, Sankey and categories are consistent (quickstart V9–V11).

- [ ] T060 [US5] Implement `apps/api/src/domain/cashflow.ts` (aggregates per month/quarter/year; transfers excluded; investment purchases count as "Gespart"; savings rate = saved / income; 12 bars ending at anchor; Sankey nodes/links income → main → sub) with unit tests (FR-030, FR-032)
- [ ] T061 [US5] Implement `CashflowModule` `GET /api/cashflow/summary`, `/sankey`, `/categories` in `apps/api/src/modules/cashflow/` and `GET /api/transactions` (filters `categoryId`, `status`, `q`, paging) + `PATCH /api/transactions/:id` (`categoryId`, `reviewStatus`, `type`, optional `createRule`) in `apps/api/src/modules/transactions/`; e2e tests
- [ ] T062 [P] [US5] Implement `CategoriesModule` CRUD for categories (delete of `is_default` → 409; "max depth 2") and rules (`priority` "ascending, unique"; `regex` "must compile") plus `POST /api/rules/apply` in `apps/api/src/modules/categories/`; e2e tests
- [ ] T063 [P] [US5] Implement `BudgetsModule` CRUD in `apps/api/src/modules/budgets/` (`category_id` unique, "expense kind only", `monthly_limit_cents` "> 0"; response with `spentCents`, `remainingCents` for the current month); e2e tests
- [ ] T064 [US5] Build `apps/web/app/components/budget/PeriodSwitcher.vue` (prev/next, "Aktueller Monat", Monat/Quartal/Jahr), `CashflowBars.vue` (Unovis grouped bar, current period hatched), summary tiles (Einnahmen, Ausgaben, Saldo, Gespart, Sparquote), `SankeyChart.vue` (Unovis Sankey, € / %), `CategoryList.vue` (Ausgaben/Einnahmen switch, counts, totals, donut, drill-down to transactions); component tests
- [ ] T065 [US5] Build pages `apps/web/app/pages/budget/index.vue` (Analyse), `budget/review.vue` (unreviewed list, category select, "Regel speichern", ≤ 2 clicks per row — SC-005), `budget/budgets.vue` (create/edit/delete, spent vs. limit), `settings/categories.vue` (category tree + rules); fill `CashflowCard.vue` and `BudgetsCard.vue` on the overview
- [ ] T066 [US5] Add Playwright journey `e2e/us5-budget.spec.ts` (switch Monat/Quartal/Jahr, step back, categorize with rule, count drops, create budget Lebenshaltung 500 € and see it on the overview)

---

## Phase 8: User Story 6 - Insurance contracts (Priority: P3)

**Goal**: Manual insurance contract list.

**Independent Test**: Add a term-life contract with 23,62 € monthly; it shows a yearly cost of 283,44 € (quickstart V12).

- [ ] T067 [US6] Implement `InsuranceModule` CRUD in `apps/api/src/modules/insurance/` (`type` enum `health|term_life|liability|household|disability|car|legal|other`; `premium_cents` "> 0"; `interval` `monthly|quarterly|semiannual|annual`; `end_date` "≥ start_date"; `notes` "≤ 2000"; derived `yearlyCostCents = premium × {12,4,2,1}`); e2e tests
- [ ] T068 [US6] Build `apps/web/app/components/insurance/ContractForm.vue` + `ContractList.vue` and page `apps/web/app/pages/insurance/index.vue` (empty state "Versicherung hinzufügen", edit, delete with confirm); Playwright journey `e2e/us6-insurance.spec.ts`

---

## Phase 9: User Story 7 - Sparkasse bank query slot (Priority: P3, later)

**Goal**: Reserve the Sparkasse live-query source without functionality.

**Independent Test**: Datenquellen shows "Sparkasse (Live-Abfrage) – geplant", not activatable (quickstart V15).

- [ ] T069 [US7] Implement `SparkasseFintsSource` placeholder in `apps/api/src/modules/sources/sparkasse-fints/sparkasse-fints.source.ts` (`status()` → `planned`, `fetch` throws `NotImplementedError`), register it in `SourcesRegistry`, show a disabled "geplant" card in `apps/web/app/pages/settings/sources.vue`; unit + component tests

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T070 [P] Responsive and theme pass over all pages at 360 px, tablet and desktop in dark/light; extend `e2e/responsive.spec.ts` to assert no horizontal scroll on every tab (SC-006)
- [ ] T071 [P] Performance check: generator for 5 years daily history + 10k transactions in `apps/api/src/database/perf-seed.ts`, add missing indexes, measure `/` render < 2 s (SC-002) and 50k-row CSV import < 30 s; record results in `specs/001-wealth-tracker-dashboard/quickstart.md`
- [ ] T072 [P] Security hardening: helmet-equivalent headers (`@fastify/helmet`) and CSP on web, verify credentials never appear in API responses or logs, upload size/type limits, `pnpm audit` clean of high/critical
- [ ] T073 [P] Write `README.md` (setup, scripts, architecture, data sources, privacy note that data stays local) and `apps/api/README.md` / `apps/web/README.md`
- [ ] T074 Run the full quickstart validation V1–V18 and fix any regressions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T001 first; T002–T004, T006–T008 in parallel after T001; T005 after T002–T004.
- **Foundational (Phase 2)**: after Setup; blocks all stories. T009 → T010 → (T017, T018, T021); T011, T012, T016, T019 in parallel; T014 → T015; T020 → T021; T022 → T023/T024.
- **US1 (P1)**: after Foundational (uses the demo seed).
- **US2 (P1)**: after Foundational; independent of US1 (its E2E checks the overview total, so run after US1 in the sequential order).
- **US3 (P2)**: needs T041 (ImportPipeline) from US2.
- **US4 (P2)**: after Foundational; independent of US2/US3.
- **US5 (P2)**: needs T040 (categorize) from US2; fills the overview cards from US1.
- **US6 (P3)**, **US7 (P3)**: after Foundational; US7 after T044 (sources page).
- **Polish**: after all chosen stories.

### Within Each User Story

Domain → service/controller with e2e tests → UI components with component tests → page assembly → Playwright journey. One commit per task.

### Parallel Opportunities

- Setup: T002, T003, T004, T006, T007, T008
- Foundational: T011, T012, T016, T019 (and T023, T024 after T022)
- US1: T025, T028, T029; then T031, T032
- US2: T035, T037, T038, T039, T043
- After Foundational: US4 and US6 can run alongside US1/US2

## Parallel Example: User Story 2

```text
Task: "T037 Sparkasse parsers in apps/api/src/modules/sources/csv/sparkasse.ts"
Task: "T038 Scalable parser in apps/api/src/modules/sources/csv/scalable.ts"
Task: "T039 Generic mapped parser in apps/api/src/modules/sources/csv/generic-mapped.ts"
Task: "T043 Manual accounts/transactions in apps/api/src/modules/accounts/"
```

## Implementation Strategy

### MVP First

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1 on demo data → validate V5–V7
3. Phase 4 US2 → validate V1–V4 with real CSV exports → usable MVP on own data

### Incremental Delivery

US3 (Scalable sync) → US4 (Investments) → US5 (Budget) → US6 (Insurance) → US7 (Sparkasse slot) → Polish. Each story is validated by its quickstart scenarios and Playwright journey before the next one starts.

## Notes

- Each task = one commit referencing its task ID and the issue; push right after each commit.
- Never commit real personal exports, recorded tokens, or `.env` files; MCP fixtures are anonymized.
- The Scalable integration never calls order-related tools (T048 enforces this in code).
