# Tasks: Bank Sync and Market Data

**Input**: Design documents from `specs/005-bank-sync-market-data/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/http-api.md, quickstart.md

**Tests**: Included (Constitution IV): domain unit, API e2e, component tests and one Playwright journey per story, against a fresh local database or the local dev server.

**Standards**: Every task follows plan.md "Coding Standards" (Prettier, ESLint flat config, JSDoc intent comments with spec references, `data-testid`, German i18n keys, zod DTOs in `packages/shared`). Gates before each commit: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`.

**Commits**: One commit per task, pushed immediately. The issue checklist is synced. No deployment tasks (Constitution V).

## Format: `[ID] [P?] [Story] Description`

---

## Phase 1: Setup

- [X] T001 [P] Add `jose` to `apps/api/package.json`. Add `ENABLE_BANKING_APP_ID`, `ENABLE_BANKING_KEY_FILE`, `ENABLE_BANKING_REDIRECT_URL` (all optional) and `BANK_DAILY_SYNC` (boolean, default false) to `apps/api/src/config/env.schema.ts` (with tests in `apps/api/test/unit/env.schema.spec.ts`), plus `ENABLE_BANKING_API_URL` (default `https://api.enablebanking.com`); document names only, never values (T033). `apps/api/data/` is already ignored. Add `*.pem` to `.gitignore`.
- [X] T002 [P] Extend `packages/shared/src/enums.ts`: `SOURCE_KINDS` + `'enable_banking'`, `SOURCE_STATUSES` + `'consent_expired'`, `TRANSACTION_SOURCES` + `'enable_banking'`. Keep `sparkasse_fints` in the enum.
- [X] T003 [P] Add zod DTOs from `contracts/http-api.md`:
  - `packages/shared/src/schemas/source.ts`: `bankInstitution`, `bankConnectRequest { aspspName, aspspCountry }`, and on `sourceDto` the optional `consentEndsAt`, `consentWarning`, `institution`, `accounts[{ id, name, maskedIban }]`;
  - `packages/shared/src/schemas/investments.ts`: `classSeriesResponse` (`twrorPct` decimal string with 4 places or `null`) and `gainSplit { totalGainCents, realizedCents, priceGainCents }` and `classPerformanceQuery`; the watchlist entry DTO gets `quotedAt`;
  - new `packages/shared/src/schemas/market-data.ts` (named `securitySearchQuery`/`securityHit`/`securitySearchResponse`, because the global search already exports `searchQuery`/`searchHit`): `securitySearchResponse { available, groups[{ assetClass, hits[{ isin, wkn?, name, assetClass }], more }] }` (`q` min 2 chars), `quoteDto`, `chartPoint`, and the extended watchlist entry body (`{ instrumentId }` or `{ isin, name, assetClass }`). Export from the package index.
- [X] T004 [P] Add German texts to `apps/web/i18n/locales/de.json`: "Bank verbinden", "Bank auswählen", "Zugang gültig bis {date}", "Zugang läuft in {days} Tagen ab", "Zugang erneuern", "Zugang abgelaufen", "Trennen", "Realisiert", "Kursgewinn", "Asset suchen", "Name, ISIN oder WKN", "Mehr anzeigen", "Sonstige", "Schon auf der Watchlist", "Suche und Kurse brauchen die Scalable-Verbindung", "Kurs vom {time}", and "Alle" for the class chips. The other chip labels reuse the existing `assetClasses` keys (Aktien, ETF, Fonds, Anleihen, Krypto, Rohstoffe, Sonstige); the app has no certificate class, so certificates show under "Sonstige".

---

## Phase 2: Foundational

- [X] T005 Migration `apps/api/src/database/migrations/0008_bank_sync_market_data.sql` and `apps/api/src/database/schema.ts`:
  - table `bank_consent` (`source_id` text PK → `data_source.id`, `aspsp_name` text not null, `aspsp_country` text not null, `valid_until` text not null ISO date-time, `created_at` default now);
  - table `quote` (`instrument_id` PK → `instrument.id` on delete cascade, `price` text "decimal string, > 0, EUR" with check, `change_abs` text, `change_pct` text, `quoted_at` text not null, `fetched_at` text not null);
  - column `instrument_value_snapshot.flow_cents` integer not null default 0;
  - update the kind/status/source CHECK lists for the new enum values.
  - Test in `apps/api/test/unit/schema-005.spec.ts` (tables, checks, cascade).
  - Deviation: the CHECK changes make drizzle rebuild `data_source` and `transactions`. With foreign keys on, the old-table drop fails or cascades into `sync_run`/`transaction_tag`, so `runMigrations` in `apps/api/src/database/migrate.ts` now switches foreign keys off around the migrator and fails on a non-empty `foreign_key_check`. The test upgrades a 0007 database with child rows.
- [X] T006 [P] Write `flow_cents` (net buy + / sell − in cents per instrument and day) in `apps/api/src/domain/instrument-values.ts` and the `perHolding` callback of `domain/snapshots.ts`; `RecomputeService` refills it. Extend `apps/api/test/unit/instrument-values.spec.ts`: buy day +, sell day −, other days 0. On the sell-out day a value-0 row keeps the sale's flow. `InstrumentBackfillService` also rebuilds depots whose rows carry no flows (rows from before 005); test in `apps/api/test/e2e/instrument-backfill.e2e-spec.ts`.

**Checkpoint**: schema and enums ready; stories can start in parallel.

---

## Phase 3: User Story 1 – Sync my Sparkasse account live (P1) 🎯 MVP

**Goal**: The owner connects their Sparkasse account through Enable Banking; balance and bookings sync without duplicates.

**Independent Test**: Fake Enable Banking in API e2e: connect → sync → second sync 0 new; CSV overlap linked, not duplicated; revoke keeps data. Real account per quickstart W1–W3.

- [X] T007 [P] [US1] Enable Banking client in `apps/api/src/modules/sources/enable-banking/client.ts`: signs an RS256 JWT with `jose` (`iss: enablebanking.com`, `aud: api.enablebanking.com`, header `kid` = app id, lifetime ≤ 1 h); provider token `ENABLE_BANKING_HTTP` for a fetch-like transport; **path allowlist** exactly `GET /aspsps`, `POST /auth`, `POST /sessions`, `GET /sessions/{id}`, `DELETE /sessions/{id}`, `GET /accounts/{uid}/details|balances|transactions` — anything else (e.g. `/payments`) throws before any request. Errors sanitized (no JWT, session id) and ≤ 500 chars. Unit test `apps/api/test/unit/enable-banking-client.spec.ts` (claims, allowlist refusal, sanitizing).
- [ ] T008 [P] [US1] Record script `apps/api/src/scripts/enable-banking-record.ts` plus package script `enable-banking:record`: uses the stored session, writes raw responses to git-ignored `apps/api/data/enable-banking-raw/`. Owner runs it once after connecting (needs T010); anonymize (IBAN, names, references, amounts scaled, dates shifted) into `apps/api/test/fixtures/enable-banking/*.json`. Until then, hand-written fixtures in the documented response shape are used.
- [X] T009 [P] [US1] Mapper `apps/api/src/modules/sources/enable-banking/mapper.ts`: accounts → batch ref `eb:<uid>` (existing accounts are found by IBAN in the pipeline), type checking, institution from consent; only `status = BOOK`; amount decimal string → cents half-even, sign from `credit_debit_indicator` (`DBIT` negative); `sourceRef` = `entry_reference` or sha256 of the raw booking; counterparty from creditor/debtor name; purpose = joined `remittance_information`; balance priority `CLBD` → `ITAV` → `XPCD`; non-EUR → row error `unknown_currency_no_rate:<cur>`; repeated refs in one batch get `#n`. Fixtures in the documented response shape with public example IBANs in `apps/api/test/fixtures/enable-banking/` until T008 replaces them. Unit test `apps/api/test/unit/enable-banking-mapper.spec.ts`.
- [X] T010 [US1] Connection service `apps/api/src/modules/sources/enable-banking/enable-banking-connection.service.ts`: `institutions(country)`, `connect(aspsp)` → `POST /auth` with `valid_until` = now + 90 days, random `state` stored server-side, `redirect_url` from env; `callback(code, state)` → `POST /sessions`, stores `{ sessionId, accountUids }` AES-GCM encrypted in `data_source.encrypted_credentials` (id `enable_banking`), upserts `bank_consent`, status `active`; `disconnect()` → `DELETE /sessions/{id}` (ignore 404), clears credentials and `bank_consent`, status `disabled`, keeps accounts and bookings. `connect` uses the bank's `maximum_consent_validity` when shorter than 90 days; a renewal closes the previous session. The account link (an existing account with the same IBAN gets `source_id`) happens in the import pipeline (T012). Covered by the API e2e test in T013.
- [X] T011 [US1] Cross-source match `apps/api/src/domain/bank-match.ts` (research R2): for each incoming booking without existing `(source, sourceRef)`, find rows on the same account with booking date ±1 day, same `amountCents`, and no `enable_banking` sourceRef; exactly one → link (set `source`/`source_ref`); several → narrow by normalized counterparty; still ambiguous or none → insert. Hook it into `apps/api/src/modules/import/import.pipeline.ts` before insert, only for sources that opt in (`PipelineOptions.matchExisting`). A linked row keeps its CSV texts and fingerprint and gets `source`/`source_ref` of the bank; it counts as skipped. Unit test `apps/api/test/unit/bank-match.spec.ts` (1 match, 2 candidates, ±1 day, already linked).
- [X] T012 [US1] Source `apps/api/src/modules/sources/enable-banking/enable-banking.source.ts`: `fetch` reads details, balances and transactions (paged by `continuation_key`, `date_from` = last sync − 7 days, first run 90 days back) for every approved uid; on 401 / expired session or `valid_until` passed → status `consent_expired` and a German error. Register in `sources.module.ts` `DATA_SOURCES`, remove `SparkasseFintsSource` and its test (the seed no longer creates the planned `sparkasse_fints` row and drops it from older databases; `accounts-overview` treats `enable_banking` as a sync kind), add `'enable_banking'` to `PULL_KINDS` in `sync.service.ts`, and daily sync via `BANK_DAILY_SYNC` in `sync.scheduler.ts` (one job per source). The pipeline runs with `matchExisting` for the bank and links an existing account with the same IBAN to the source (`source_id` set when it was empty or `csv`). Tests: `sync-scheduler.spec.ts`, `seed.spec.ts`.
- [X] T013 [US1] Routes in `apps/api/src/modules/sources/sync.controller.ts` per `contracts/http-api.md`: `GET bank/institutions`, `POST bank/connect`, `GET bank/callback` (302 to `/settings/sources?connected=bank` or `?error=bank&reason=denied|state|expired`); `GET /api/sources` adds `consentEndsAt`, `consentWarning` (≤ 14 days), `institution`, `accounts`; `DELETE enable_banking` uses `disconnect()`; the callback `state` is single-use. API e2e `apps/api/test/e2e/bank-sync.e2e-spec.ts` with faked `ENABLE_BANKING_HTTP`: connect, callback with wrong state, sync (balance, bookings, 2nd run 0 new), CSV overlap linked, expired consent → `consent_expired`, payment path refused, responses never contain session id or key, disconnect keeps data.
- [X] T014 [P] [US1] Web `apps/web/app/components/import/BankCard.vue` and `apps/web/app/pages/settings/sources.vue`: bank picker (searchable select from institutions), "Bank verbinden" redirect, status, institution, accounts with masked IBAN, "Zugang gültig bis", warning badge and "Zugang erneuern" from 14 days, "Aktualisieren", "Trennen" with confirm; toasts for `?connected=bank` / `?error=bank&reason=…`. Show a global notice (`BankConsentNotice.vue`, client-only) in the app layout when `consentWarning` or `consent_expired`. Component test `apps/web/tests/bank-card.spec.ts`.
- [X] T015 [US1] Playwright `e2e/us-b1-bank-sync.spec.ts` with mocked API routes (client-side navigation): connect flow redirect, active card with accounts, warning notice, disconnect. Desktop and 360 px.
- [ ] T016 [US1] Owner walkthrough W1–W3 on the local dev server with the real account (owner logs in at the bank; app key set locally by the owner). Record results (no personal data) in `quickstart.md`, then T008 fixtures.

**Checkpoint**: US1 complete; the owner's checking account syncs live.

---

## Phase 4: User Story 2 – Compare asset classes in the chart (P2)

**Goal**: Chips add per-class lines; headline and table stay "Alle"; % lines stay flat after a sale.

**Independent Test**: Seeded data with a full stock sale mid-period; toggle "Aktien".

- [X] T017 [P] [US2] Domain `apps/api/src/domain/class-performance.ts` (research R5): group daily `valueCents` and `flowCents` by asset class; chain `r_t = (V_t − F_t) / V_{t−1} − 1` with decimal.js, `r_t = 0` when `V_{t−1} = 0`; `twrorPct` as a ratio string with 6 places like the other `…Pct` fields, `null` before the first holding. Unit test `apps/api/test/unit/class-performance.spec.ts`: flat after sale, € value 0 after sale, buy-in day not counted as gain, two classes independent, total equals sum of class values.
- [X] T018 [US2] Endpoint `GET /api/investments/performance/classes?from&to` in `apps/api/src/modules/investments/investments.controller.ts` and `investments.service.ts` (replaces the 004 `assetClassPerformance` filter; drop the `assetClass` query on `performance` and update its tests). API e2e: `apps/api/test/e2e/performance-asset-class.e2e-spec.ts` (004 filter test replaced: class lines end at the class position sums, "Alle" at the depot value, ratio format).
- [X] T019 [US2] Web `apps/web/app/components/investments/PerformanceChart.vue`: chips (multi-select) add one line per class with its class color and legend entry; "Alle" always drawn; headline and `PositionsTable` ignore chips (remove the `useState('positions-asset-class')` coupling and its badge); € view uses `valueCents`, % view uses `twrorPct`; chips without holdings disabled; "–" for `null`; a legend lists "Alle" and each selected class. The positions table keeps its own 003 filter chips, decoupled from the chart; `e2e/us-p5-investments.spec.ts` now checks that the headline stays on "Alle". Component test `apps/web/tests/class-chart.spec.ts`.
- [X] T020 [US2] Playwright `e2e/us-b2-class-chart.spec.ts`: toggle two chips, headline unchanged, € and % switch, 360 px.

---

## Phase 5: User Story 3 – Realized gain and price gain (P2)

**Goal**: Security page shows GuV = Realisiert + Kursgewinn, exact to the cent.

**Independent Test**: Seeded security bought twice, partly sold.

- [ ] T021 [P] [US3] Domain: expose `gainSplit(state, valueCents)` in `apps/api/src/domain/positions.ts` (research R7): `realizedCents = realizedNetCents`, `priceGainCents = valueCents − remainingCostCents`, `totalGainCents = realized + price`; dividends excluded. Unit test in `apps/api/test/unit/positions.spec.ts`: never sold, fully sold (price gain 0), partly sold (sum exact).
- [ ] T022 [US3] `GET /api/investments/instruments/:id` adds `gain` in `investments.service.ts`; API e2e in `apps/api/test/e2e/investments.e2e-spec.ts`. Web `apps/web/app/pages/investments/[instrumentId].vue`: GuV with "Realisiert" and "Kursgewinn" rows (`Money` signed), `data-testid` `gain-total|gain-realized|gain-price`.
- [ ] T023 [US3] Playwright `e2e/us-b3-gain-split.spec.ts`: partly sold security shows both parts and the sum.

---

## Phase 6: User Story 4 – Find a security and watch quotes (P3)

**Goal**: "Asset suchen" by name/ISIN/WKN with class chips; quotes and charts from the Scalable connection, refreshed in the background.

**Independent Test**: Fake Scalable MCP serving search/quote/chart; real account per quickstart W5.

- [ ] T024 [P] [US4] Add `search_securities`, `get_security_quote`, `get_security_chart` to `READ_TOOLS` in `apps/api/src/modules/sources/scalable-mcp/allowlist.ts`; record their responses with `scalable:record` (extend `apps/api/src/scripts/scalable-record.ts`) and add anonymized fixtures in `apps/api/test/fixtures/scalable-mcp/`. Extend `apps/api/test/unit/scalable-allowlist.spec.ts` (new tools allowed, order tools still denied).
- [ ] T025 [US4] New module `apps/api/src/modules/market-data/` (`market-data.module.ts`, `market-data.service.ts`, `market-data.controller.ts`): `search(q, class)` via `search_securities` (min 2 chars else 400; map Scalable types to `ASSET_CLASSES`, unknown → `other`; group by class, 10 per group + `more`); `quotes(ids)`; `refresh()` for watchlist and held instruments → upsert `quote` (decimal strings) and daily closes into `price` (`source = 'scalable'`); `chart(id, range)`. Without an active Scalable source: `available: false` / 409. Register in `app.module.ts`.
- [ ] T026 [US4] `apps/api/src/modules/market-data/quote.scheduler.ts`: every 15 minutes Mon–Fri 08:00–22:00 Europe/Berlin, skipped when Scalable is not active or a refresh is running. Unit test `apps/api/test/unit/quote-scheduler.spec.ts` (inside/outside market hours, DST).
- [ ] T027 [US4] Extend `POST /api/watchlists/:id/entries` in `apps/api/src/modules/watchlists/` to accept `{ isin, name, assetClass }`, creating the instrument when unknown; 409 when already on the list. API e2e `apps/api/test/e2e/market-data.e2e-spec.ts` with the fake MCP transport: search groups, class filter, add, duplicate 409, refresh writes quote and prices, no Scalable → `available: false`.
- [ ] T028 [P] [US4] Web `apps/web/app/components/watchlists/AssetSearchDialog.vue`: input "Name, ISIN oder WKN" (debounce 300 ms, min 2 chars), class chips, results grouped by class with name, ISIN and class, "Mehr anzeigen", add to the chosen watchlist, toast on 409, hint with link to Datenquellen when `available: false`. Open it from the watchlist page `apps/web/app/pages/investments/watchlists/[id].vue` (replacing or next to `AddSecurityForm`). Component test `apps/web/tests/asset-search.spec.ts`.
- [ ] T029 [US4] Web `apps/web/app/components/watchlists/WatchlistTable.vue`: price, daily change (abs and %), "Kurs vom {time}" and a sparkline from `chart` (1M); "Aktualisieren" calls refresh; "–" for missing quotes; old quotes show their date.
- [ ] T030 [US4] Playwright `e2e/us-b4-watchlist-search.spec.ts`: search, filter "Aktien", add, duplicate refused, quote shown; 360 px.
- [ ] T031 [US4] Owner walkthrough W4–W5 on the local dev server with the real Scalable connection; note results (no personal data) in `quickstart.md`.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T032 [P] Research addendum: confirm in `research.md` R1/R6 the actual data sent to Enable Banking and Scalable as observed in T016/T031 (Security Requirements of the constitution).
- [ ] T033 [P] README: short "Bankverbindung (Enable Banking)" section — owner registers a restricted-production app, links own accounts, sets the env values locally; key never in the repo.
- [ ] T034 Full gates: `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e` (desktop and 360 px, dark and light); quickstart W6; mark spec Status "Implemented".

---

## Dependencies & Execution Order

- **Setup (T001–T004)**: no dependencies, all [P].
- **Foundational (T005–T006)**: after Setup; block all stories (T006 needed by US2 only, T005 by all).
- **US1 (T007–T016)**: after T005. T007, T008, T009 parallel; T010 → T011 → T012 → T013; T014 parallel to T010–T013 against the contract; T015 after T013/T014; T016 last (needs the owner).
- **US2 (T017–T020)**: after T006. T017 → T018 → T019 → T020.
- **US3 (T021–T023)**: after Setup only; independent of US1/US2.
- **US4 (T024–T031)**: after T005. T024 → T025 → T026/T027 → T028/T029 → T030 → T031.
- **Polish (T032–T034)**: after all stories.

US2, US3 and US4 do not depend on US1 and can run in any order after Foundational.

## Parallel Examples

- US1: T007 (client), T009 (mapper) and T014 (BankCard against the contract) together.
- US2 + US3: T017 (class domain) and T021 (gain split) together.
- US4: T024 (allowlist) while T028 (dialog) is built against the contract.

## Implementation Strategy

1. **MVP**: Setup + Foundational + US1 → validate W1–W3 with the real account → stop and review.
2. Add US3 (small) and US2 → validate W4.
3. Add US4 → validate W5.
4. Polish T032–T034.

Each story ends with its Playwright journey and stays shippable on its own.
